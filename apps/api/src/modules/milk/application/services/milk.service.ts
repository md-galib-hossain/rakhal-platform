import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  CattlePurpose,
  MilkSession,
  MilkTankActivity,
  MilkTankType,
  Prisma,
  SafetyWithdrawalStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { MilkTankService } from 'src/modules/inventory/application/services/milk-tank.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { dropPct, isAnomaly } from '../../domain/milk-anomaly';
import { MilkLogQueryDto } from '../../presentation/dto/milk-query.dto';
import { ReviewAnomalyDto } from '../../presentation/dto/review-anomaly.dto';
import { SaveMilkLogDto } from '../../presentation/dto/save-milk-log.dto';
import { SubmitMilkDto } from '../../presentation/dto/submit-milk.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MILKING_PURPOSES = [CattlePurpose.MILK, CattlePurpose.DUAL_PURPOSE];

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
    logger: LoggerService,
  ) {
    this.log = logger.setContext(MilkService.name);
  }

  async overview(farmId: string, dateStr?: string) {
    const day = this.normalizeDate(dateStr ?? new Date().toISOString());
    const [today, yesterday, lastWeek, lastYear, sessions, trend] =
      await Promise.all([
        this.dayBreakdown(farmId, day),
        this.dayTotal(farmId, this.shiftDays(day, -1)),
        this.dayTotal(farmId, this.shiftDays(day, -7)),
        this.dayTotal(farmId, this.shiftDays(day, -365)),
        this.sessionStatuses(farmId, day),
        this.trend(farmId, day, 30),
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
      trend30Days: trend,
    };
  }

  async logTable(farmId: string, query: MilkLogQueryDto) {
    const day = this.normalizeDate(query.date ?? new Date().toISOString());
    const cows = await this.prisma.cattle.findMany({
      where: {
        farmId,
        isActive: true,
        purpose: { in: MILKING_PURPOSES },
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
          anomalyFlag: cowEntries.some((e) => e.anomalyFlag),
        },
      };
    });

    return {
      date: this.dateOnly(day),
      sessionConfig: await this.farmSettings.milkActiveSessions(farmId),
      entries: rows,
    };
  }

  async saveLog(farmId: string, userId: string, dto: SaveMilkLogDto) {
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
    const [withholding, avgRows] = await Promise.all([
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
    ]);
    const avgMap = new Map(avgRows.map((r) => [r.cattleId, r._avg.yieldL]));
    const anomalyFraction = await this.farmSettings.milkAnomalyFraction(farmId);

    let anomaliesFlagged = 0;
    let sessionTotal = 0;
    for (const entry of dto.entries) {
      const tankType = withholding.has(entry.cattleId)
        ? MilkTankType.WITHHOLDING
        : MilkTankType.SELLABLE;
      const anomalyFlag = isAnomaly(
        entry.yieldL,
        avgMap.get(entry.cattleId) ?? null,
        anomalyFraction,
      );
      if (anomalyFlag) anomaliesFlagged += 1;
      sessionTotal += entry.yieldL;

      await this.prisma.milkLogEntry.upsert({
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
          anomalyFlag,
          anomalyNote: entry.anomalyNote,
          createdBy: userId,
        },
        update: {
          yieldL: entry.yieldL,
          tankType,
          anomalyFlag,
          anomalyNote: entry.anomalyNote,
        },
      });
    }

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

    await this.prisma.milkLogEntry.updateMany({
      where: { farmId, logDate, session: dto.session, submitted: false },
      data: { submitted: true, submittedAt: new Date() },
    });

    const mainUpdated = await this.collectInto(
      farmId,
      userId,
      MilkTankType.SELLABLE,
      sellableTotal,
      dto.session,
    );
    const withholdingUpdated = await this.collectInto(
      farmId,
      userId,
      MilkTankType.WITHHOLDING,
      withholdingTotal,
      dto.session,
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

  private async collectInto(
    farmId: string,
    userId: string,
    tankType: MilkTankType,
    volume: number,
    session: MilkSession,
  ): Promise<boolean> {
    if (volume <= 0) return false;
    const tank = await this.prisma.milkTank.findFirst({
      where: { farmId, tankType, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!tank) return false;
    try {
      await this.milkTankService.adjustVolume(farmId, userId, tank.id, {
        delta: volume,
        activityType: MilkTankActivity.COLLECTION,
        source: 'milk_log_submission',
        notes: `Session ${session.toLowerCase()}`,
      });
      return true;
    } catch (error) {
      this.log.warn('Milk tank collection skipped', {
        farmId,
        tankType,
        volume,
        reason: (error as Error).message,
      });
      return false;
    }
  }

  private async activeWithholding(
    farmId: string,
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.safetyWithdrawal.findMany({
      where: {
        farmId,
        cattleId: { in: ids },
        status: SafetyWithdrawalStatus.ACTIVE,
        milkWithdrawalUntil: { gt: new Date() },
      },
      select: { cattleId: true },
    });
    return new Set(rows.map((r) => r.cattleId));
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

  private async trend(farmId: string, day: Date, days: number) {
    const from = this.shiftDays(day, -(days - 1));
    const rows = await this.prisma.milkLogEntry.groupBy({
      by: ['logDate'],
      where: { farmId, submitted: true, logDate: { gte: from, lte: day } },
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
