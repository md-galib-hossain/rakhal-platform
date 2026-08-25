import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  CattlePurpose,
  MilkDisposition,
  MilkSession,
  MilkTankActivity,
  MilkTankType,
  Prisma,
  ProductionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { MilkTankService } from 'src/modules/inventory/application/services/milk-tank.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { HealthService } from 'src/modules/health/application/services/health.service';
import { AnimalHoldService } from 'src/modules/cattle/application/services/animal-hold.service';
import {
  DEFAULT_SESSION_CONFIG,
  dropPct,
  isAnomaly,
} from '../../domain/milk-anomaly';
import {
  isWithinColostrumWindow,
  resolveMilkDisposition,
} from '../../domain/milk-disposition';
import {
  deriveMilkEligibility,
  MilkEligibility,
} from '../../domain/milk-eligibility';
// RAKHAL-284: reused from Reproduction's domain layer directly (same
// direct-cross-module-read precedent RAKHAL-277/278 already established the
// other direction) — pure TS, no framework/Prisma imports in either file, so
// importing them here doesn't require `MilkModule` to import
// `ReproductionModule` (which would be the first import in that direction;
// avoided to keep this change inside this ticket's own Lane).
import {
  buildDailyYieldSeries,
  CurveEntry,
} from 'src/modules/reproduction/domain/lactation-curve';
import { computeLactationPeak } from 'src/modules/reproduction/domain/lactation-yield';
import {
  MilkLogQueryDto,
  MilkTrendRange,
} from '../../presentation/dto/milk-query.dto';
import { ReviewAnomalyDto } from '../../presentation/dto/review-anomaly.dto';
import { SaveMilkLogDto } from '../../presentation/dto/save-milk-log.dto';
import { SubmitMilkDto } from '../../presentation/dto/submit-milk.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MILKING_PURPOSES = [CattlePurpose.MILK, CattlePurpose.DUAL_PURPOSE];

/** `null` = lifetime (no lower date bound on the trend query). */
const TREND_RANGE_DAYS: Record<MilkTrendRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  lifetime: null,
};

/**
 * Milk Module service (PRD §10). Farm-scoped (`farmId` from the token context).
 * Workers log per-cow session yields (draft), then "Submit All Logs" finalizes a
 * session: it updates the Inventory SELLABLE/WITHHOLDING tanks
 * (`MilkTankService.adjustVolume`), emits the milk-session AQR event (+0.5) per
 * cow, and writes the Activity Log summary. Withholding is derived from the
 * health SafetyWithdrawal, so a flagged cow's tank is locked to WITHHOLDING.
 */
@Injectable()
export class MilkService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aqrService: AqrService,
    private readonly activityLog: ActivityLogService,
    private readonly milkTankService: MilkTankService,
    private readonly farmSettings: FarmSettingsService,
    private readonly healthService: HealthService,
    private readonly animalHoldService: AnimalHoldService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(MilkService.name);
  }

  async overview(farmId: string, dateStr?: string, range?: MilkTrendRange) {
    const day = this.normalizeDate(dateStr ?? new Date().toISOString());
    const [today, yesterday, lastWeek, lastYear, sessions, trend] =
      await Promise.all([
        this.dayBreakdown(farmId, day),
        this.dayTotal(farmId, this.shiftDays(day, -1)),
        this.dayTotal(farmId, this.shiftDays(day, -7)),
        this.dayTotal(farmId, this.shiftDays(day, -365)),
        this.sessionStatuses(farmId, day),
        this.trend(farmId, day, TREND_RANGE_DAYS[range ?? '30d']),
      ]);

    return {
      date: this.dateOnly(day),
      today,
      yesterday: { totalL: yesterday },
      sameDayLastWeek: { totalL: lastWeek },
      sameDayLastYear: { totalL: lastYear },
      // Cost/price data come from Finance + Settings (not yet built).
      costPerLitreToday: null,
      marketValueToday: null,
      sessionsStatus: sessions,
      trendRange: range ?? '30d',
      trend,
    };
  }

  async logTable(farmId: string, query: MilkLogQueryDto) {
    const day = this.normalizeDate(query.date ?? new Date().toISOString());
    const cows = await this.prisma.cattle.findMany({
      where: {
        farmId,
        isActive: true,
        purpose: { in: MILKING_PURPOSES },
        // A cow marked DRY (manually, or auto-set at calving/dry-off) has no
        // milk to log — purpose alone doesn't capture that (purpose describes
        // what the cow is raised for, not her current lactation state).
        productionStatus: { not: ProductionStatus.DRY },
        ...(query.shedId ? { shedId: query.shedId } : {}),
      },
      orderBy: { tagNumber: 'asc' },
      include: { shed: { select: { name: true } } },
    });
    const ids = cows.map((c) => c.id);

    const [entries, withholding, avg7d] = await Promise.all([
      this.prisma.milkLogEntry.findMany({
        where: { farmId, logDate: day, cattleId: { in: ids } },
      }),
      this.activeWithholding(farmId, ids),
      this.avgDailyYield(farmId, ids, day),
    ]);

    const byCow = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byCow.get(e.cattleId) ?? [];
      list.push(e);
      byCow.set(e.cattleId, list);
    }

    const rows = cows.map((cow) => {
      const cowEntries = byCow.get(cow.id) ?? [];
      const isWithholding = withholding.has(cow.id);
      const sessionYield = (s: MilkSession) =>
        cowEntries.find((e) => e.session === s)?.yieldL ?? null;
      const total = cowEntries.reduce((sum, e) => sum + e.yieldL, 0);
      return {
        cattleId: cow.id,
        name: cow.name,
        tag: cow.tagNumber,
        shed: cow.shed?.name ?? null,
        avgYield7d: avg7d.get(cow.id) ?? null,
        productionStatus: 'milking',
        withholding: isWithholding,
        log: {
          morningL: sessionYield(MilkSession.MORNING),
          noonL: sessionYield(MilkSession.NOON),
          eveningL: sessionYield(MilkSession.EVENING),
          nightL: sessionYield(MilkSession.NIGHT),
          totalL: Math.round(total * 10) / 10,
          tank: isWithholding
            ? MilkTankType.WITHHOLDING
            : MilkTankType.SELLABLE,
          tankLocked: isWithholding,
          // UI exposes one Tank pick per cow per day (not per session) — surface whichever
          // saved session entry already named a tank, if any, so a reload doesn't lose it.
          tankId: cowEntries.find((e) => e.tankId)?.tankId ?? null,
          anomalyFlag: cowEntries.some((e) => e.anomalyFlag),
          // Which sessions are already `submitted` — the frontend uses this to warn
          // before an edit reconciles the tank balance instead of silently drifting.
          submittedSessions: cowEntries
            .filter((e) => e.submitted)
            .map((e) => e.session),
          // RAKHAL-277's per-entry `disposition` (SALEABLE/WITHHELD/COLOSTRUM/
          // CALF_FEED/DISCARDED/HOUSEHOLD_USE), keyed by session since this row
          // is one-per-cow-per-day but disposition is computed per log entry.
          dispositions: Object.fromEntries(
            cowEntries.map((e) => [e.session, e.disposition]),
          ),
        },
      };
    });

    return {
      date: this.dateOnly(day),
      sessionConfig: await this.farmSettings.milkActiveSessions(farmId),
      entries: rows,
    };
  }

  /**
   * RAKHAL-278: a cow's current, animal-level milk eligibility — distinct
   * from `resolveMilkDisposition()` (RAKHAL-277), which classifies a single
   * per-log-entry row. Exposed via `GET /milk/cattle/:id/eligibility`
   * (`MilkController.eligibility`).
   */
  async getMilkEligibility(
    farmId: string,
    cattleId: string,
  ): Promise<MilkEligibility> {
    const [withholdingIds, activeLactation, colostrumWindowDays, discardHolds] =
      await Promise.all([
        this.healthService.activeMilkWithholdingCattleIds(farmId, [cattleId]),
        this.prisma.lactation.findFirst({
          where: { cattleId, endDate: null, cattle: { farmId } },
          select: { startDate: true },
        }),
        this.farmSettings.milkColostrumWindowDays(farmId),
        this.animalHoldService.activeHoldsForCattle(
          farmId,
          cattleId,
          'MILK_DISCARD',
        ),
      ]);

    return deriveMilkEligibility({
      isWithheld: withholdingIds.has(cattleId),
      isInColostrumWindow: isWithinColostrumWindow({
        activeLactationStartDate: activeLactation?.startDate ?? null,
        asOfDate: new Date(),
        colostrumWindowDays,
      }),
      hasDiscardRequiredHold: discardHolds.length > 0,
    });
  }

  async saveLog(farmId: string, userId: string, dto: SaveMilkLogDto) {
    await this.assertSessionActive(farmId, dto.session);
    const logDate = this.normalizeDate(dto.date);
    const ids = dto.entries.map((e) => e.cattleId);

    const cows = await this.prisma.cattle.findMany({
      where: { id: { in: ids }, farmId },
      select: { id: true },
    });
    const valid = new Set(cows.map((c) => c.id));
    const missing = ids.find((id) => !valid.has(id));
    if (missing) {
      throw new BadRequestException(
        `Cattle ${missing} does not belong to this farm`,
      );
    }

    const from = this.shiftDays(logDate, -7);
    const [
      withholding,
      avgRows,
      existingEntries,
      activeLactations,
      colostrumWindowDays,
    ] = await Promise.all([
      this.activeWithholding(farmId, ids),
      this.prisma.milkLogEntry.groupBy({
        by: ['cattleId'],
        where: {
          farmId,
          session: dto.session,
          submitted: true,
          cattleId: { in: ids },
          logDate: { gte: from, lt: logDate },
        },
        _avg: { yieldL: true },
      }),
      // Pre-fetch today's entries for these cows — needed to detect an edit to an
      // already-submitted entry (whose yield already moved into a tank balance) so the
      // tank delta can be reconciled instead of silently drifting from the log.
      this.prisma.milkLogEntry.findMany({
        where: { farmId, logDate, session: dto.session, cattleId: { in: ids } },
      }),
      // RAKHAL-277: each cow's active `Lactation` (no `endDate`) gates the colostrum
      // window check — queried directly off the reproduction module's Prisma model
      // (a pure read, no cross-module service dependency needed for this).
      // RAKHAL-284: also select `id` — the same active-lactation rows already
      // fetched for the colostrum check double as the peak-recompute target,
      // no second query needed.
      this.prisma.lactation.findMany({
        where: { cattleId: { in: ids }, endDate: null },
        select: { id: true, cattleId: true, startDate: true },
      }),
      this.farmSettings.milkColostrumWindowDays(farmId),
    ]);
    const avgMap = new Map(avgRows.map((r) => [r.cattleId, r._avg.yieldL]));
    const existingByCow = new Map(existingEntries.map((e) => [e.cattleId, e]));
    const anomalyFraction = await this.farmSettings.milkAnomalyFraction(farmId);
    const lactationStartByCow = new Map(
      activeLactations.map((l) => [l.cattleId, l.startDate]),
    );
    const activeLactationIdByCow = new Map(
      activeLactations.map((l) => [l.cattleId, l.id]),
    );

    // Entries may name a specific tank (header default or a per-row override) — validate
    // up front that it belongs to this farm, is active, and matches the cow's required
    // SELLABLE/WITHHOLDING type (a withholding cow can never route into a sellable tank).
    const tankIds = [
      ...new Set(
        dto.entries.map((e) => e.tankId).filter((id): id is string => !!id),
      ),
    ];
    const tanks = tankIds.length
      ? await this.prisma.milkTank.findMany({
          where: { id: { in: tankIds }, farmId, isActive: true },
        })
      : [];
    const tankById = new Map(tanks.map((t) => [t.id, t]));
    const missingTank = tankIds.find((id) => !tankById.has(id));
    if (missingTank) {
      throw new BadRequestException(
        `Milk tank ${missingTank} not found for this farm`,
      );
    }

    let anomaliesFlagged = 0;
    let sessionTotal = 0;
    // A whole-session transaction: entry upserts and any submitted-entry tank
    // reconciliation below must commit together, same as submit()'s pattern.
    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.entries) {
        const isWithheld = withholding.has(entry.cattleId);
        const tankType = isWithheld
          ? MilkTankType.WITHHOLDING
          : MilkTankType.SELLABLE;
        // RAKHAL-277: business-meaning classification, computed pre-insert in the
        // same transaction as the eligibility check above — never a schema default.
        // `tankType` (physical routing, above) and `disposition` stay consistent: a
        // WITHHELD-disposition entry always routes to the WITHHOLDING tank, since
        // `isWithheld` gates both.
        // RAKHAL-290 (verified, not bypassable): `isWithheld` is re-derived from
        // `HealthService.activeMilkWithholdingCattleIds` on every call to this
        // method — `saveLog()` is the sole writer of `MilkLogEntry.disposition`/
        // `tankType` (`submit()` only flips `submitted`; `MilkImportService
        // .confirm()` replays every imported row back through this same method
        // rather than writing `MilkLogEntry` directly) and `SaveMilkLogDto`
        // exposes no `disposition`/`tankType` field a caller could supply to
        // override this — so `disposition=SALEABLE` while `isWithheld` is true
        // is structurally impossible, not just discouraged.
        const disposition: MilkDisposition = resolveMilkDisposition({
          isWithheld,
          activeLactationStartDate:
            lactationStartByCow.get(entry.cattleId) ?? null,
          logDate,
          colostrumWindowDays,
        });
        if (entry.tankId) {
          const tank = tankById.get(entry.tankId)!;
          if (tank.tankType !== tankType) {
            throw new BadRequestException(
              `Selected tank does not match the ${tankType.toLowerCase()} requirement for cattle ${entry.cattleId}`,
            );
          }
        }
        const anomalyFlag = isAnomaly(
          entry.yieldL,
          avgMap.get(entry.cattleId) ?? null,
          anomalyFraction,
        );
        if (anomalyFlag) anomaliesFlagged += 1;
        sessionTotal += entry.yieldL;

        const newTankId = entry.tankId ?? null;
        const existing = existingByCow.get(entry.cattleId);

        await tx.milkLogEntry.upsert({
          where: {
            cattleId_logDate_session: {
              cattleId: entry.cattleId,
              logDate,
              session: dto.session,
            },
          },
          create: {
            farmId,
            cattleId: entry.cattleId,
            logDate,
            session: dto.session,
            yieldL: entry.yieldL,
            tankType,
            disposition,
            tankId: newTankId,
            anomalyFlag,
            anomalyNote: entry.anomalyNote,
            editReason: entry.editReason ?? null,
            createdBy: userId,
          },
          update: {
            yieldL: entry.yieldL,
            tankType,
            disposition,
            tankId: newTankId,
            anomalyFlag,
            anomalyNote: entry.anomalyNote,
            editReason: entry.editReason ?? null,
          },
        });

        // The entry already contributed to a tank balance at submit time — a changed
        // yield/tank/type here must reverse the old contribution and apply the new one,
        // or the tank balance silently drifts from what the log actually says.
        if (
          existing?.submitted &&
          (existing.yieldL !== entry.yieldL ||
            existing.tankId !== newTankId ||
            existing.tankType !== tankType)
        ) {
          await this.collectInto(
            farmId,
            userId,
            existing.tankType,
            existing.tankId,
            -existing.yieldL,
            dto.session,
            tx,
            MilkTankActivity.ADJUSTMENT,
          );
          await this.collectInto(
            farmId,
            userId,
            tankType,
            newTankId,
            entry.yieldL,
            dto.session,
            tx,
            MilkTankActivity.ADJUSTMENT,
          );
        }
      }

      // RAKHAL-284: recompute each cow's active-lactation peak inside the same
      // transaction as the entry upserts above — a write that changes a day's
      // yield (or its data-quality via a session recorded) must never leave a
      // stale peak. Deduped per cow (saveLog's dto is one session's worth of
      // entries across possibly many cows, not per-entry).
      const cowsToRecompute = new Set(
        dto.entries
          .map((e) => activeLactationIdByCow.get(e.cattleId))
          .filter((id): id is string => !!id),
      );
      for (const lactationId of cowsToRecompute) {
        await this.recomputeLactationPeak(farmId, lactationId, tx);
      }
    });

    this.log.info('Milk log saved', {
      farmId,
      session: dto.session,
      count: dto.entries.length,
    });
    return {
      saved: dto.entries.length,
      anomaliesFlagged,
      sessionTotalL: Math.round(sessionTotal * 10) / 10,
    };
  }

  async submit(farmId: string, userId: string, dto: SubmitMilkDto) {
    await this.assertSessionActive(farmId, dto.session);
    const logDate = this.normalizeDate(dto.date);
    // Only entries not yet submitted are finalized — so re-submitting a session
    // is idempotent and never double-counts volume already collected into a tank.
    const pending = await this.prisma.milkLogEntry.findMany({
      where: { farmId, logDate, session: dto.session, submitted: false },
      include: {
        cattle: { select: { id: true, name: true, tagNumber: true } },
      },
    });
    if (pending.length === 0) {
      throw new BadRequestException(
        'No new milk log entries to submit for this session',
      );
    }

    const sellableTotal = this.sum(pending, MilkTankType.SELLABLE);
    const withholdingTotal = this.sum(pending, MilkTankType.WITHHOLDING);

    // Group by the specific tank each entry named (header default or per-row override) —
    // several distinct SELLABLE (or WITHHOLDING) tanks can each collect their own share in
    // one submit. Entries with no explicit tank fall back into a shared "type default" group,
    // resolved the same way submit() always has (first active tank of that type).
    const groups = new Map<
      string,
      { tankType: MilkTankType; tankId: string | null; volume: number }
    >();
    for (const entry of pending) {
      const key = entry.tankId ?? `type:${entry.tankType}`;
      const g = groups.get(key) ?? {
        tankType: entry.tankType,
        tankId: entry.tankId,
        volume: 0,
      };
      g.volume += entry.yieldL;
      groups.set(key, g);
    }

    // Entry finalization and tank collection commit atomically: a tank rejecting
    // the volume (over capacity) must not leave entries marked submitted with no
    // matching tank movement (previously this failure was swallowed silently).
    const { mainUpdated, withholdingUpdated } = await this.prisma.$transaction(
      async (tx) => {
        await tx.milkLogEntry.updateMany({
          where: { farmId, logDate, session: dto.session, submitted: false },
          data: { submitted: true, submittedAt: new Date() },
        });

        let mainUpdated = false;
        let withholdingUpdated = false;
        for (const group of groups.values()) {
          const updated = await this.collectInto(
            farmId,
            userId,
            group.tankType,
            group.tankId,
            Math.round(group.volume * 10) / 10,
            dto.session,
            tx,
          );
          if (updated && group.tankType === MilkTankType.SELLABLE) {
            mainUpdated = true;
          }
          if (updated && group.tankType === MilkTankType.WITHHOLDING) {
            withholdingUpdated = true;
          }
        }
        return { mainUpdated, withholdingUpdated };
      },
    );

    // AQR: milk session logged (+0.5) per newly-submitted cow (RD-006 last emitter).
    for (const entry of pending) {
      await this.aqrService.applyEvent(
        farmId,
        entry.cattleId,
        'milk_session_logged',
        {
          actorId: userId,
        },
      );
    }

    // Activity Log: session summary (PRD §10.5.4).
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.MILK_PRODUCTION,
      eventTitle: 'Milk Session Submitted',
      actionDetails: `Milk Session [${dto.session.toLowerCase()}] logged — ${sellableTotal}L sellable / ${withholdingTotal}L withholding.`,
      actorId: userId,
    });

    this.log.info('Milk session submitted', {
      farmId,
      session: dto.session,
      sellableTotal,
      withholdingTotal,
    });

    return {
      date: this.dateOnly(logDate),
      session: dto.session,
      totalCowsLogged: pending.length,
      sellableTotalL: sellableTotal,
      withholdingTotalL: withholdingTotal,
      mainTankUpdated: mainUpdated,
      withholdingTankUpdated: withholdingUpdated,
      activityLogCreated: true,
      anomalies: pending
        .filter((e) => e.anomalyFlag)
        .map((e) => ({
          cattleId: e.cattleId,
          name: e.cattle.name ?? e.cattle.tagNumber,
          yieldL: e.yieldL,
        })),
    };
  }

  async anomalies(farmId: string, dateStr?: string) {
    const where: Prisma.MilkLogEntryWhereInput = {
      farmId,
      anomalyFlag: true,
      ...(dateStr ? { logDate: this.normalizeDate(dateStr) } : {}),
    };
    const rows = await this.prisma.milkLogEntry.findMany({
      where,
      orderBy: [{ logDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        cattle: { select: { id: true, name: true, tagNumber: true } },
      },
    });

    const anomalies = await Promise.all(
      rows.map(async (row) => {
        const avg = await this.sessionAvg(
          farmId,
          row.cattleId,
          row.session,
          row.logDate,
        );
        return {
          id: row.id,
          cattleId: row.cattleId,
          name: row.cattle.name ?? row.cattle.tagNumber,
          tag: row.cattle.tagNumber,
          date: this.dateOnly(row.logDate),
          session: row.session,
          yieldL: row.yieldL,
          avg7dL: avg,
          dropPct: dropPct(row.yieldL, avg),
          workerNote: row.anomalyNote,
          reviewed: row.reviewed,
        };
      }),
    );
    return { anomalies };
  }

  async reviewAnomaly(farmId: string, id: string, dto: ReviewAnomalyDto) {
    const entry = await this.prisma.milkLogEntry.findFirst({
      where: { id, farmId },
    });
    if (!entry) throw new NotFoundException('Milk log entry not found');
    if (!entry.anomalyFlag) {
      throw new BadRequestException('Entry is not flagged as an anomaly');
    }
    const updated = await this.prisma.milkLogEntry.update({
      where: { id },
      data: { reviewed: true, reviewAction: dto.action, reviewNote: dto.notes },
    });
    this.log.info('Milk anomaly reviewed', { entryId: id, farmId });
    return updated;
  }

  // ---- Helpers -------------------------------------------------------------

  /**
   * A farm's owner controls which sessions are unlocked (`FarmSettingsService
   * .milkActiveSessions`, default MORNING+EVENING). Logging/submitting to a
   * disabled session was previously unenforced at write time — only the
   * `sessionConfig` read path reflected it — so a client could write to a
   * locked session regardless of what the UI showed.
   */
  private async assertSessionActive(
    farmId: string,
    session: MilkSession,
  ): Promise<void> {
    const active = await this.farmSettings.milkActiveSessions(farmId);
    if (!active.includes(session)) {
      throw new BadRequestException(
        `The ${session.toLowerCase()} session is not enabled for this farm`,
      );
    }
  }

  /**
   * `tx` is required — runs inside `submit()`'s or `saveLog()`'s transaction, so a
   * capacity/negative-balance rejection from `adjustVolume` propagates and rolls
   * back the whole call. A missing tank (farm never configured one for this type,
   * or a named tank got archived after entries were saved) is a legitimate no-op,
   * not an error. `tankIdOverride` targets one specific tank (header default / row
   * override); omitted, falls back to "first active tank of this type" like before
   * per-tank selection existed. `volume` may be negative — `saveLog()` reconciling
   * an edited submitted entry passes a negative delta to reverse its old
   * contribution before applying the new one; `activityType` labels which case
   * this is in the tank's audit log (`COLLECTION` for a fresh submit, `ADJUSTMENT`
   * for a post-submit edit reconciliation).
   */
  private async collectInto(
    farmId: string,
    userId: string,
    tankType: MilkTankType,
    tankIdOverride: string | null,
    volume: number,
    session: MilkSession,
    tx: Prisma.TransactionClient,
    activityType: MilkTankActivity = MilkTankActivity.COLLECTION,
  ): Promise<boolean> {
    if (volume === 0) return false;
    const tank = tankIdOverride
      ? await tx.milkTank.findFirst({
          where: { id: tankIdOverride, farmId, tankType, isActive: true },
        })
      : await tx.milkTank.findFirst({
          where: { farmId, tankType, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
    if (!tank) return false;
    await this.milkTankService.adjustVolume(
      farmId,
      userId,
      tank.id,
      {
        delta: volume,
        activityType,
        source:
          activityType === MilkTankActivity.ADJUSTMENT
            ? 'milk_log_edit'
            : 'milk_log_submission',
        notes:
          activityType === MilkTankActivity.ADJUSTMENT
            ? `Session ${session.toLowerCase()} — entry edited after submit`
            : `Session ${session.toLowerCase()}`,
      },
      tx,
    );
    return true;
  }

  /**
   * RAKHAL-284: recompute `Lactation.peakMilkYield`/`peakMilkDate`/
   * `peakDaysInMilk` for one active lactation, run inside `saveLog()`'s
   * transaction so the peak can never observe a partially-written session.
   * Rebuilds the full daily-yield series from scratch each time (same
   * `buildDailyYieldSeries` RAKHAL-283's `GET /curve` uses) rather than
   * comparing today's total against the stored peak — a single day's
   * `dataQuality` can flip from `incomplete` to `complete` (or vice versa,
   * on an edit) as a byproduct of this very write, which could change which
   * day the true peak-so-far is, not just today's. A `null` result (no
   * `complete` day recorded yet) intentionally leaves the stored columns
   * untouched rather than clearing them — a lactation can't "lose" a
   * previously-earned peak just because a later write briefly computed no
   * peak (which can't actually happen once one complete day exists, but the
   * guard is defensive).
   */
  private async recomputeLactationPeak(
    farmId: string,
    lactationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const lactation = await tx.lactation.findFirst({
      where: { id: lactationId, cattle: { farmId } },
      select: { id: true, cattleId: true, startDate: true, endDate: true },
    });
    if (!lactation) return;

    const rangeEnd = lactation.endDate ?? new Date();
    const entries = await tx.milkLogEntry.findMany({
      where: {
        cattleId: lactation.cattleId,
        logDate: { gte: lactation.startDate, lte: rangeEnd },
      },
      select: { logDate: true, session: true, yieldL: true },
    });
    const curveEntries: CurveEntry[] = entries;

    const configuredSessions =
      await this.farmSettings.milkActiveSessions(farmId);
    const expectedSessions =
      configuredSessions.length > 0
        ? configuredSessions
        : DEFAULT_SESSION_CONFIG;

    const series = buildDailyYieldSeries({
      startDate: lactation.startDate,
      endDate: rangeEnd,
      entries: curveEntries,
      expectedSessions,
    });

    const peak = computeLactationPeak(series);
    if (!peak) return;

    await tx.lactation.update({
      where: { id: lactation.id },
      data: {
        peakMilkYield: peak.peakMilkYield,
        peakMilkDate: peak.peakMilkDate,
        peakDaysInMilk: peak.peakDaysInMilk,
      },
    });
  }

  // Delegates to HealthService — single source of truth shared with the Cattle
  // domain's deriveHealthStatus(), so the withholding rule can't drift between
  // the two modules.
  private activeWithholding(
    farmId: string,
    ids: string[],
  ): Promise<Set<string>> {
    return this.healthService.activeMilkWithholdingCattleIds(farmId, ids);
  }

  /** Average daily total yield over the prior 7 days, per cow — public wrapper for cross-module
   * reuse (Feed Formulator's cow-driven requirement calc, `FeedRequirementsService`). Defaults
   * `asOf` to now (today's midnight boundary handled the same way as every other caller). */
  async averageDailyYield(
    farmId: string,
    cattleIds: string[],
    asOf: Date = new Date(),
  ): Promise<Map<string, number>> {
    return this.avgDailyYield(farmId, cattleIds, asOf);
  }

  /** Average daily total yield over the prior 7 days, per cow. */
  private async avgDailyYield(
    farmId: string,
    ids: string[],
    day: Date,
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const from = this.shiftDays(day, -7);
    const rows = await this.prisma.milkLogEntry.groupBy({
      by: ['cattleId'],
      where: {
        farmId,
        submitted: true,
        cattleId: { in: ids },
        logDate: { gte: from, lt: day },
      },
      _sum: { yieldL: true },
    });
    return new Map(
      rows.map((r) => [
        r.cattleId,
        Math.round(((r._sum.yieldL ?? 0) / 7) * 10) / 10,
      ]),
    );
  }

  private async sessionAvg(
    farmId: string,
    cattleId: string,
    session: MilkSession,
    before: Date,
  ): Promise<number | null> {
    const from = this.shiftDays(before, -7);
    const agg = await this.prisma.milkLogEntry.aggregate({
      where: {
        farmId,
        cattleId,
        session,
        submitted: true,
        logDate: { gte: from, lt: before },
      },
      _avg: { yieldL: true },
    });
    return agg._avg.yieldL == null
      ? null
      : Math.round(agg._avg.yieldL * 10) / 10;
  }

  private async dayBreakdown(farmId: string, day: Date) {
    const rows = await this.prisma.milkLogEntry.groupBy({
      by: ['tankType'],
      where: { farmId, logDate: day, submitted: true },
      _sum: { yieldL: true },
    });
    const byType = new Map(rows.map((r) => [r.tankType, r._sum.yieldL ?? 0]));
    const sellableL =
      Math.round((byType.get(MilkTankType.SELLABLE) ?? 0) * 10) / 10;
    const withholdingL =
      Math.round((byType.get(MilkTankType.WITHHOLDING) ?? 0) * 10) / 10;
    return {
      totalL: Math.round((sellableL + withholdingL) * 10) / 10,
      sellableL,
      withholdingL,
      calfL: 0,
    };
  }

  private async dayTotal(farmId: string, day: Date): Promise<number> {
    const agg = await this.prisma.milkLogEntry.aggregate({
      where: { farmId, logDate: day, submitted: true },
      _sum: { yieldL: true },
    });
    return Math.round((agg._sum.yieldL ?? 0) * 10) / 10;
  }

  private async sessionStatuses(farmId: string, day: Date) {
    const [rows, activeSessions] = await Promise.all([
      this.prisma.milkLogEntry.groupBy({
        by: ['session', 'submitted'],
        where: { farmId, logDate: day },
        _count: { _all: true },
      }),
      this.farmSettings.milkActiveSessions(farmId),
    ]);
    const status: Record<string, string> = {};
    for (const session of Object.values(MilkSession)) {
      if (!activeSessions.includes(session)) {
        status[session.toLowerCase()] = 'not_configured';
        continue;
      }
      const submitted = rows.some((r) => r.session === session && r.submitted);
      const draft = rows.some((r) => r.session === session && !r.submitted);
      status[session.toLowerCase()] = submitted
        ? 'submitted'
        : draft
          ? 'pending'
          : 'pending';
    }
    return status;
  }

  private async trend(farmId: string, day: Date, days: number | null) {
    const from = days == null ? null : this.shiftDays(day, -(days - 1));
    const rows = await this.prisma.milkLogEntry.groupBy({
      by: ['logDate'],
      where: {
        farmId,
        submitted: true,
        logDate: from == null ? { lte: day } : { gte: from, lte: day },
      },
      _sum: { yieldL: true },
    });
    return rows
      .map((r) => ({
        date: this.dateOnly(r.logDate),
        totalL: Math.round((r._sum.yieldL ?? 0) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private sum(
    entries: Array<{ tankType: MilkTankType; yieldL: number }>,
    tankType: MilkTankType,
  ): number {
    const total = entries
      .filter((e) => e.tankType === tankType)
      .reduce((acc, e) => acc + e.yieldL, 0);
    return Math.round(total * 10) / 10;
  }

  private normalizeDate(dateStr: string): Date {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  }

  private shiftDays(day: Date, delta: number): Date {
    return new Date(day.getTime() + delta * DAY_MS);
  }

  private dateOnly(day: Date): string {
    return day.toISOString().slice(0, 10);
  }
}
