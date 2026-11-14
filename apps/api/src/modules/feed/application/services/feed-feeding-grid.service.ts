import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedDistributionCattleItem,
  FeedGridSourceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { FeedDistributionService } from './feed-distribution.service';
import { FeedStockService } from './feed-stock.service';
import { FeedLotResolver } from './feed-lot-resolver.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { FeedPlanService } from './feed-plan.service';
import { FeedRequirementsService } from './feed-requirements.service';
import { FeedLookaheadService } from './feed-lookahead.service';
import {
  computeProgramFit,
  computeRemainingFit,
  remainingRequirement,
  toApiFit,
} from '../../domain/program-fit';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import {
  blendNutrition,
  NutritionValues,
} from '../../domain/nutrition-profile';
import { SaveFeedDraftDto } from '../../presentation/dto/save-feed-draft.dto';
import { ConfirmFeedDraftDto } from '../../presentation/dto/confirm-feed-draft.dto';
import { VoidFeedCattleItemDto } from '../../presentation/dto/void-feed-cattle-item.dto';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Frozen per-line nutrient snapshot (RAKHAL-327/328 follow-up) — same field set/names as
 * `FeedStock`'s own snapshot and `FeedDistributionItem`'s new nullable columns. */
type NutrientSnapshot = {
  dmPct: number;
  cpPct: number;
  meMjPerKgDm: number;
  fatPct: number | null;
  ndfPct: number | null;
  rdpPct: number | null;
  rupPct: number | null;
  starchPct: number | null;
  adfPct: number | null;
  calciumPct: number | null;
  phosphorusPct: number | null;
  tdnPct: number | null;
} | null;

/** The 12 snapshot columns of a profile (sugars has no snapshot column). */
const snapshotOf = (v: NutritionValues): NonNullable<NutrientSnapshot> => ({
  dmPct: v.dmPct,
  cpPct: v.cpPct,
  meMjPerKgDm: v.meMjPerKgDm,
  fatPct: v.fatPct,
  ndfPct: v.ndfPct,
  rdpPct: v.rdpPct,
  rupPct: v.rupPct,
  starchPct: v.starchPct,
  adfPct: v.adfPct,
  calciumPct: v.calciumPct,
  phosphorusPct: v.phosphorusPct,
  tdnPct: v.tdnPct,
});

/** RAKHAL-430 (Feeding Favourites): one cow's/line's resolved feed source — always exactly one of
 * `feedItemId`/`feedStockId` set, matching `sourceType`. The unified shape `resolveEntrySource()`
 * returns and every per-source grouping/validation in `confirm()`/`saveDraft()` operates on. */
/** RAKHAL-457: the program snapshot a confirmed cattle item carries (ADR-027 D12). */
type PlanSnap = { planId: string; planLineId: string; plannedKg: number };

type ResolvedSource = {
  sourceType: FeedGridSourceType;
  feedItemId: string | null;
  feedStockId: string | null;
};

/**
 * Feeding Grid (2026-08-15) — replaces Quick Feed. A per-cow, spreadsheet-style feeding session:
 * a farmer opens the grid for a day, sees every cow with its
 * carried-forward default quantity (yesterday's confirmed per-head value, regardless of which exact
 * prior date it came from), edits freely with auto-saved drafts (`FeedFeedingDraft`, zero inventory
 * effect), then "Confirm" turns the day's quantities into one real `FeedDistribution` (+ one
 * aggregate `FeedDistributionItem` line, matching the old `quickFeed()`'s single-line shape) with a
 * `FeedDistributionCattleItem` per cow, and decrements the named `FeedItem`/`FeedStock` source.
 */
@Injectable()
export class FeedFeedingGridService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly feedDistribution: FeedDistributionService,
    private readonly feedStock: FeedStockService,
    private readonly feedItems: FeedItemService,
    private readonly lotResolver: FeedLotResolver,
    private readonly programs: FeedPlanResolverService,
    private readonly planService: FeedPlanService,
    private readonly requirements: FeedRequirementsService,
    private readonly lookahead: FeedLookaheadService,
    private readonly clock: FarmClockService,
  ) {
    this.log = logger.setContext(FeedFeedingGridService.name);
  }

  /**
   * RAKHAL-434: per-day feeding-entry status for the missed-entry calendar picker on the Feed
   * Grid page. Expected coverage per day is every active cow having a non-voided Feeding Grid
   * entry that day. `complete` = every active cow covered, `partial` = some, `missing` = none.
   * Days before the farm existed or after today are never `missing`.
   */
  async calendar(farmId: string, month: string) {
    const [year, m] = month.split('-').map(Number);
    const from = new Date(Date.UTC(year, m - 1, 1));
    const to = new Date(Date.UTC(year, m, 1));
    // The farm's own "today" (Farm.timezone), not the UTC day — a UTC+6 farm's Sep 30 is still Sep 29 in UTC until 6 AM.
    const today = await this.clock.todayStart(farmId);

    const [farm, cattle, rows] = await Promise.all([
      this.prisma.farm.findUnique({
        where: { id: farmId },
        select: { createdAt: true },
      }),
      this.prisma.cattle.findMany({
        where: activeHerd(farmId),
        select: { id: true },
      }),
      this.prisma.feedDistributionCattleItem.findMany({
        where: {
          voidedAt: null,
          distribution: {
            farmId,
            sourceType: 'FEEDING_GRID',
            voidedAt: null,
            distributedAt: { gte: from, lt: to },
          },
        },
        select: {
          cattleId: true,
          distribution: { select: { distributedAt: true } },
        },
      }),
    ]);
    const farmCreatedDay = farm
      ? this.dayStart(farm.createdAt.toISOString())
      : null;
    const activeIds = new Set(cattle.map((c) => c.id));

    const coverageByDay = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!activeIds.has(row.cattleId)) continue;
      const key = this.dateOnly(row.distribution.distributedAt);
      const covered = coverageByDay.get(key) ?? new Set<string>();
      covered.add(row.cattleId);
      coverageByDay.set(key, covered);
    }

    const days: Array<{
      date: string;
      status: 'complete' | 'partial' | 'missing' | 'future' | 'before_farm';
    }> = [];
    for (let d = new Date(from); d < to; d = new Date(d.getTime() + 86400000)) {
      const dateStr = this.dateOnly(d);
      let status: 'complete' | 'partial' | 'missing' | 'future' | 'before_farm';
      if (d.getTime() > today.getTime()) {
        status = 'future';
      } else if (farmCreatedDay && d.getTime() < farmCreatedDay.getTime()) {
        status = 'before_farm';
      } else if (activeIds.size === 0) {
        status = 'missing';
      } else {
        const covered = coverageByDay.get(dateStr)?.size ?? 0;
        if (covered === 0) status = 'missing';
        else if (covered >= activeIds.size) status = 'complete';
        else status = 'partial';
      }
      days.push({ date: dateStr, status });
    }

    return { month, days };
  }

  async getGrid(farmId: string, date: string) {
    const logDate = this.dayStart(date);
    const cattle = await this.prisma.cattle.findMany({
      where: activeHerd(farmId),
      select: { id: true, name: true, tagNumber: true },
      orderBy: { tagNumber: 'asc' },
    });
    const cattleIds = cattle.map((c) => c.id);
    if (cattleIds.length === 0) {
      return { date: date, sections: [], cows: [] };
    }

    const [
      drafts,
      defaults,
      defaultSources,
      confirmedToday,
      confirmedSupply,
      programByCow,
      requirementRes,
      lookaheadByCow,
    ] = await Promise.all([
      this.prisma.feedFeedingDraft.findMany({
        where: { farmId, cattleId: { in: cattleIds }, logDate },
      }),
      this.computeDefaults(farmId, cattleIds),
      this.resolveDefaultSources(farmId, cattle),
      this.computeConfirmedToday(cattleIds, farmId, logDate),
      this.computeConfirmedSupply(cattleIds, farmId, logDate),
      // RAKHAL-457 (MILESTONE 27): the program each cow is on, and what she needs today.
      this.programs.resolveForCattle(farmId, cattleIds),
      this.requirements.forCattle(farmId, cattleIds, date),
      // RAKHAL-459a: dry-off / calving / peak-milk coming up, so the plan can be adjusted before it stops fitting.
      this.lookahead.forCattle(farmId, cattleIds, logDate),
    ]);
    const draftsByCattle = this.groupByCattle(drafts);
    const requirementByCow = new Map(
      requirementRes.cows.map((c) => [c.cattle_id, c]),
    );

    // One section per resolved program (D10). Individual programs of the same plan share a section; a
    // group program is its own section per group.
    type Section = {
      id: string;
      program: NonNullable<ReturnType<typeof programByCow.get>>;
      cattleIds: string[];
    };
    const sectionsById = new Map<string, Section>();
    const sectionOfCow = new Map<string, string>();
    for (const [cowId, program] of programByCow) {
      const id = [program.planId, program.via, program.groupId ?? ''].join(':');
      const section = sectionsById.get(id) ?? { id, program, cattleIds: [] };
      section.cattleIds.push(cowId);
      sectionsById.set(id, section);
      sectionOfCow.set(cowId, id);
    }
    // What each program supplies per head per day (Σ lines; `complete` = every line resolved to a lot).
    const totalsBySection = new Map<
      string,
      { dmKg: number; cpKg: number; meMj: number; complete: boolean }
    >();
    const sections = await Promise.all(
      [...sectionsById.values()].map(async (sec) => {
        const supply = await this.planService.resolveSupply(farmId, {
          lines: sec.program.lines,
        });
        totalsBySection.set(sec.id, {
          dmKg: supply.reduce((t, l) => t + (l.supply.dm_kg ?? 0), 0),
          cpKg: supply.reduce((t, l) => t + (l.supply.cp_kg ?? 0), 0),
          meMj: supply.reduce((t, l) => t + (l.supply.me_mj ?? 0), 0),
          complete: supply.every((l) => l.density != null),
        });
        return {
          id: sec.id,
          plan_id: sec.program.planId,
          plan_name: sec.program.planName,
          kind: sec.program.kind,
          via: sec.program.via,
          group_id: sec.program.groupId ?? null,
          conflict: sec.program.conflict,
          cattle_ids: sec.cattleIds,
          lines: supply.map((l) => ({
            line_id: l.line_id,
            line_type: l.line_type,
            name: l.name,
            kg_per_day: l.kg_per_day,
            // Pre-fill per confirm: the whole daily kg (one confirm per cow per day; editable).
            prefill_kg: round2(l.kg_per_day),
            source: l.source,
            density: l.density,
            stock_ok: l.stock_ok,
          })),
        };
      }),
    );
    const linesBySection = new Map(sections.map((sec) => [sec.id, sec.lines]));

    const cows = cattle.map((c) => {
      const program = programByCow.get(c.id);
      const sectionId = sectionOfCow.get(c.id) ?? null;
      const req = requirementByCow.get(c.id);
      // RAKHAL-458: what her program supplies vs what she needs, against the farm's tolerance bands.
      const totals = sectionId ? totalsBySection.get(sectionId) : undefined;
      // A cow may be fed several times a day: once she has been fed, her program is judged against
      // what she STILL needs (requirement − confirmed supply), not the full daily figure.
      const fedSoFar = confirmedSupply.get(c.id);
      const requirementAmounts = req
        ? {
            dmKg: req.requirements.dm_kg,
            cpKg: req.requirements.cp_kg,
            meMj: req.requirements.me_mj,
          }
        : null;
      const remaining =
        requirementAmounts && fedSoFar
          ? remainingRequirement(requirementAmounts, {
              dmKg: fedSoFar.dm_kg,
              cpKg: fedSoFar.cp_kg,
              meMj: fedSoFar.me_mj,
            })
          : null;
      const fit =
        totals && requirementAmounts && req
          ? fedSoFar
            ? computeRemainingFit(
                { dmKg: totals.dmKg, cpKg: totals.cpKg, meMj: totals.meMj },
                requirementAmounts,
                {
                  dmKg: fedSoFar.dm_kg,
                  cpKg: fedSoFar.cp_kg,
                  meMj: fedSoFar.me_mj,
                },
                requirementRes.bands,
                req.flags.length > 0 || !totals.complete || !fedSoFar.complete,
              )
            : computeProgramFit(
                { dmKg: totals.dmKg, cpKg: totals.cpKg, meMj: totals.meMj },
                requirementAmounts,
                requirementRes.bands,
                req.flags.length > 0 || !totals.complete,
              )
          : null;
      return {
        planned_supply: totals
          ? {
              dm_kg: round2(totals.dmKg),
              cp_kg: round2(totals.cpKg),
              me_mj: round2(totals.meMj),
              complete: totals.complete,
            }
          : null,
        fit: fit ? toApiFit(fit) : null,
        cattle_id: c.id,
        name: c.name,
        tag_number: c.tagNumber,
        drafts: (draftsByCattle.get(c.id) ?? []).map((d) => this.mapDraft(d)),
        default_offered_kg: defaults.get(c.id) ?? null,
        default_source: this.mapResolvedSource(defaultSources.get(c.id)),
        confirmed_offered_kg: confirmedToday.get(c.id) ?? null,
        confirmed_supply: confirmedSupply.get(c.id) ?? null,
        // What she still needs today (null until she has been fed once). Fit above is judged against it.
        remaining_requirement: remaining
          ? {
              dm_kg: round2(remaining.dmKg),
              cp_kg: round2(remaining.cpKg),
              me_mj: round2(remaining.meMj),
            }
          : null,
        program_section_id: sectionId,
        program_conflict: program?.conflict ?? false,
        lookahead: lookaheadByCow.get(c.id) ?? [],
        planned_kg_by_line: sectionId
          ? Object.fromEntries(
              (linesBySection.get(sectionId) ?? []).map((l) => [
                l.line_id,
                l.prefill_kg,
              ]),
            )
          : {},
        requirement: req
          ? {
              dm_kg: req.requirements.dm_kg,
              cp_kg: req.requirements.cp_kg,
              me_mj: req.requirements.me_mj,
              flags: req.flags,
              // MILESTONE 28: which model produced it, and the calculated figures beside a manual one.
              source: req.source,
              ...('manual' in req
                ? {
                    dynamic_requirements: req.dynamic_requirements,
                    manual: req.manual,
                  }
                : {}),
            }
          : null,
      };
    });

    // Section header summary ("6 under CP"): how many of its cows are ok / warn / bad / estimated.
    const summary = new Map<
      string,
      { ok: number; warn: number; bad: number; estimated: number }
    >();
    for (const c of cows) {
      if (!c.program_section_id || !c.fit) continue;
      const s = summary.get(c.program_section_id) ?? {
        ok: 0,
        warn: 0,
        bad: 0,
        estimated: 0,
      };
      s[c.fit.severity] += 1;
      if (c.fit.estimated) s.estimated += 1;
      summary.set(c.program_section_id, s);
    }
    return {
      date,
      sections: sections.map((sec) => ({
        ...sec,
        fit_summary: summary.get(sec.id) ?? {
          ok: 0,
          warn: 0,
          bad: 0,
          estimated: 0,
        },
      })),
      cows,
    };
  }

  /**
   * Auto-save a day's per-cow quantities. Each entry resolves its own source — its own override
   * if given, else the call's top-level source (RAKHAL-430, `resolveEntrySource`) — so one call
   * can stage different cows against different sources. Uniqueness on entry's own resolved
   * `{date, sourceType, feedItemId|feedStockId}` key is enforced two ways: this method's own
   * `findFirst`-then-create/update (fast path, no conflict in the common single-request case), and
   * — since two concurrent requests can both pass that `findFirst` before either commits — a real
   * DB-level partial unique index per branch (RD-089, `FeedFeedingDraft`'s own doc comment; Postgres
   * can't express a single ordinary constraint across two mutually exclusive nullable FK columns).
   * A `create` that loses that race throws Prisma `P2002`, which aborts the Postgres transaction — so the
   * whole transaction is retried once (RD-109), and the second attempt updates the winner's row: never a
   * 500, never a silent duplicate. RAKHAL-457: an entry may carry `lines` (one draft row per source, each
   * with its own refusal and the plan line it was pre-filled from).
   */
  async saveDraft(farmId: string, userId: string, dto: SaveFeedDraftDto) {
    const logDate = this.dayStart(dto.date);
    const cattleIds = dto.entries.map((e) => e.cattleId);
    await this.assertCattleBelongToFarm(farmId, cattleIds);

    // Flatten to one draft row per (cow, source). An entry with `lines` (RAKHAL-457, a program's lines
    // plus any extras) is one row per line; the single-source shape is exactly one row.
    type Item = {
      cattleId: string;
      source: ResolvedSource;
      offeredKg: number;
      refusalKg: number | null;
      planLineId: string | null;
    };
    const items: Item[] = [];
    for (const entry of dto.entries) {
      if (entry.lines?.length) {
        for (const l of entry.lines) {
          items.push({
            cattleId: entry.cattleId,
            source: this.resolveEntrySource(dto, l) as ResolvedSource,
            offeredKg: l.offeredKg,
            refusalKg: l.refusalKg ?? null,
            planLineId: l.planLineId ?? null,
          });
        }
        continue;
      }
      const source = this.resolveEntrySource(dto, entry);
      if (!source) {
        throw new BadRequestException(
          `Cattle ${entry.cattleId} needs a source — either its own sourceType or the call's top-level sourceType`,
        );
      }
      items.push({
        cattleId: entry.cattleId,
        source,
        offeredKg: entry.offeredKg,
        refusalKg: entry.refusalKg ?? null,
        planLineId: null,
      });
    }

    const seen = new Set<string>();
    for (const it of items) {
      const key = `${it.cattleId}|${this.sourceKey(it.source)}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Cattle ${it.cattleId} lists the same feed twice — combine the quantities into one line`,
        );
      }
      seen.add(key);
    }

    const distinctSources = new Map<string, ResolvedSource>();
    for (const { source } of items) {
      distinctSources.set(this.sourceKey(source), source);
    }
    for (const source of distinctSources.values()) {
      await this.validateSource(farmId, source);
    }

    const write = () =>
      this.prisma.$transaction(async (tx) => {
        const rows: Prisma.FeedFeedingDraftGetPayload<object>[] = [];
        for (const it of items) {
          const where = {
            farmId,
            cattleId: it.cattleId,
            logDate,
            sourceType: it.source.sourceType,
            feedItemId: it.source.feedItemId,
            feedStockId: it.source.feedStockId,
          };
          const existing = await tx.feedFeedingDraft.findFirst({ where });
          rows.push(
            existing
              ? await tx.feedFeedingDraft.update({
                  where: { id: existing.id },
                  data: {
                    offeredKg: round2(it.offeredKg),
                    // RAKHAL-453/RD-107: only touch refusal / plan line when the caller sent them.
                    ...(it.refusalKg != null && {
                      refusalKg: round2(it.refusalKg),
                    }),
                    ...(it.planLineId != null && {
                      feedPlanLineId: it.planLineId,
                    }),
                  },
                })
              : await tx.feedFeedingDraft.create({
                  data: {
                    ...where,
                    offeredKg: round2(it.offeredKg),
                    refusalKg:
                      it.refusalKg != null ? round2(it.refusalKg) : null,
                    feedPlanLineId: it.planLineId,
                    createdBy: userId,
                  },
                }),
          );
        }
        return rows;
      });

    // RD-089/RD-109: two concurrent saves can both pass the `findFirst` before either commits; the loser's
    // `create` then hits the partial unique index (P2002). Postgres aborts the whole transaction on that
    // error, so recovering *inside* it is impossible — retry the transaction once instead; the second
    // attempt finds the winner's row and updates it. Never a 500, never a duplicate row.
    let saved: Prisma.FeedFeedingDraftGetPayload<object>[];
    try {
      saved = await write();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        saved = await write();
      } else {
        throw e;
      }
    }

    this.log.info('Feeding grid draft saved', {
      farmId,
      date: dto.date,
      sources: distinctSources.size,
      entries: saved.length,
    });
    return { saved: saved.length, drafts: saved.map((d) => this.mapDraft(d)) };
  }

  /**
   * Turn a day's feeding-grid quantities into one real `FeedDistribution`.
   *
   * RAKHAL-440/RD-100: cow **scope** depends on whether `dto.entries` is given. With entries, scope
   * is *exactly* the cows named there — nothing else. Without entries, scope is the whole active
   * herd, matching `getGrid()`, so a bare confirm
   * with nothing typed still resolves a quantity per cow via drafts/the carried-forward default.
   * **Before this fix**, a non-empty `entries` still fell through to the whole-grid path for every
   * cow it didn't name — a farmer who checked one row and clicked "Confirm (1)" could silently pull
   * in every other cow's own carried-forward default too, via the call's top-level default source.
   * Real bug, reproduced live: 1 cow selected, request tried to draw stock for ~92 unrelated ones.
   * The per-row source model (RFE-115/117) made that fallback actively wrong — a farmer who curates
   * an explicit entry list means exactly those cows, not "those plus whatever else resolves."
   *
   * RAKHAL-430 (Feeding Favourites): **multi-source**. Each cow resolves to its own `{offeredKg,
   * source}`: a named `dto.entries` line (own source override, else the call's top-level default)
   * when entries is given; **else** (no entries at all) its own existing draft for this date (any
   * source — if more than one exists, the top-level default disambiguates when given, else an
   * unambiguous single draft is used), else the carried-forward default *quantity*, only resolvable
   * when the call has a top-level default source to pair it with. Cows that resolve to 0/no source
   * are skipped entirely. Resolved lines are grouped by distinct source: one `FeedDistributionItem`
   * per group, each stock-validated and decremented independently — a shortfall on one source blocks
   * the whole confirm before anything is written, same "fail fast before the transaction" convention
   * `assertSufficientStock` already established here.
   */
  async confirm(farmId: string, userId: string, dto: ConfirmFeedDraftDto) {
    const logDate = this.dayStart(dto.date);
    const cattle = await this.prisma.cattle.findMany({
      where: activeHerd(farmId),
      select: { id: true },
    });
    const cattleIds = cattle.map((c) => c.id);
    if (cattleIds.length === 0) {
      throw new BadRequestException(
        'No cattle in scope to confirm feeding for',
      );
    }

    const entriesMap = new Map((dto.entries ?? []).map((e) => [e.cattleId, e]));
    const dtoDefaultSource = dto.sourceType
      ? this.resolveEntrySource(dto, {})
      : null;
    const [drafts, defaults] = await Promise.all([
      this.prisma.feedFeedingDraft.findMany({
        where: { farmId, cattleId: { in: cattleIds }, logDate },
      }),
      this.computeDefaults(farmId, cattleIds),
    ]);
    const draftsByCattle = this.groupByCattle(drafts);

    // RAKHAL-440/RD-100: with a curated `entries` list, scope is exactly those cows — never fall
    // through to the whole-grid draft/default path for a cow the caller didn't name. Without
    // entries, scope stays the full grid (unchanged "confirm the whole day" behavior).
    const scopedCattleIds =
      entriesMap.size > 0
        ? cattleIds.filter((id) => entriesMap.has(id))
        : cattleIds;

    type Line = {
      cattleId: string;
      offeredKg: number;
      /** Per-cow leftover, weighed back from that cow's own container (2026-09-23 user request —
       * only meaningful here because this farm feeds individual containers, not a shared bunk).
       * Only ever comes from an explicit `entries[]` line; the draft-carry-forward and
       * group-default paths below have no weigh-back to carry, so they default to 0. */
      refusalKg: number;
      source: ResolvedSource;
      /** RAKHAL-457: the plan line this kg was pre-filled from (client-sent); resolved into `plan` below. */
      planLineId?: string | null;
      plan?: PlanSnap | null;
    };
    const lines: Line[] = [];
    for (const cattleId of scopedCattleIds) {
      const entry = entriesMap.get(cattleId);
      if (entry) {
        if (entry.lines?.length) {
          // RAKHAL-457: one entry per source for this cow. A cow-level refusal (no per-line one) is split
          // across the lines in proportion to offered kg.
          const totalOffered = entry.lines.reduce((s, l) => s + l.offeredKg, 0);
          const perLine = entry.lines.some((l) => l.refusalKg != null);
          for (const el of entry.lines) {
            const source = this.resolveEntrySource(dto, el);
            const qty = round2(el.offeredKg);
            if (!source || qty <= 0) continue;
            const refusalKg = perLine
              ? round2(el.refusalKg ?? 0)
              : totalOffered > 0
                ? round2((entry.refusalKg ?? 0) * (el.offeredKg / totalOffered))
                : 0;
            lines.push({
              cattleId,
              offeredKg: qty,
              refusalKg,
              source,
              planLineId: el.planLineId ?? null,
            });
          }
          continue;
        }
        const source = this.resolveEntrySource(dto, entry);
        const qty = round2(entry.offeredKg);
        const refusalKg = round2(entry.refusalKg ?? 0);
        if (source && qty > 0)
          lines.push({ cattleId, offeredKg: qty, refusalKg, source });
        continue;
      }

      const cowDrafts = draftsByCattle.get(cattleId) ?? [];
      // RAKHAL-457: a cow whose drafts came from a program's lines confirms every one of them.
      if (cowDrafts.length > 1 && cowDrafts.some((d) => d.feedPlanLineId)) {
        for (const d of cowDrafts) {
          const qty = round2(d.offeredKg);
          if (qty <= 0) continue;
          lines.push({
            cattleId,
            offeredKg: qty,
            refusalKg: round2(d.refusalKg ?? 0),
            source: {
              sourceType: d.sourceType,
              feedItemId: d.feedItemId,
              feedStockId: d.feedStockId,
            },
            planLineId: d.feedPlanLineId,
          });
        }
        continue;
      }
      const matchingDraft = dtoDefaultSource
        ? cowDrafts.find(
            (d) =>
              d.sourceType === dtoDefaultSource.sourceType &&
              d.feedItemId === dtoDefaultSource.feedItemId &&
              d.feedStockId === dtoDefaultSource.feedStockId,
          )
        : undefined;
      const chosenDraft =
        matchingDraft ?? (cowDrafts.length === 1 ? cowDrafts[0] : undefined);
      if (chosenDraft) {
        const qty = round2(chosenDraft.offeredKg);
        if (qty > 0) {
          lines.push({
            cattleId,
            offeredKg: qty,
            // RAKHAL-453/RD-107: carry the refusal the user weighed before confirming.
            refusalKg: round2(chosenDraft.refusalKg ?? 0),
            source: {
              sourceType: chosenDraft.sourceType,
              feedItemId: chosenDraft.feedItemId,
              feedStockId: chosenDraft.feedStockId,
            },
            planLineId: chosenDraft.feedPlanLineId,
          });
        }
        continue;
      }

      if (dtoDefaultSource) {
        const qty = round2(defaults.get(cattleId) ?? 0);
        if (qty > 0) {
          lines.push({
            cattleId,
            offeredKg: qty,
            refusalKg: 0,
            source: dtoDefaultSource,
          });
        }
      }
      // else: no source resolvable for this cow at all — skipped, not a 0. RAKHAL-431's
      // resolution ladder (own last-used → group default) replaces this gap.
    }

    if (lines.length === 0) {
      throw new BadRequestException(
        'No determinable quantity/source for any cow in scope',
      );
    }

    // A cow may be fed more than once a day (AM/PM, a top-up): every confirm is its own voidable
    // feeding row, and `computeConfirmedToday`/`computeConfirmedSupply` sum the live ones. The
    // grid compares what a new feeding supplies against the REMAINING requirement, not the full one.

    // RAKHAL-457 (ADR-027 D12): snapshot the program each plan-linked line was fed under. `plannedKg` is
    // the plan line's daily kg — exactly what the grid pre-fills. A plan line
    // that no longer exists (the plan was edited after the grid loaded) is treated as off-plan rather than
    // blocking the confirm; a confirmed row is never rewritten by a later plan edit.
    const planLineIds = [
      ...new Set(
        lines.map((l) => l.planLineId).filter((id): id is string => !!id),
      ),
    ];
    if (planLineIds.length > 0) {
      const planRows = await this.prisma.feedPlanLine.findMany({
        where: { farmId, id: { in: planLineIds } },
        select: { id: true, planId: true, kgPerDay: true },
      });
      const snap = new Map(
        planRows.map((r) => [
          r.id,
          {
            planId: r.planId,
            planLineId: r.id,
            plannedKg: round2(r.kgPerDay),
          } satisfies PlanSnap,
        ]),
      );
      for (const l of lines) {
        l.plan = l.planLineId ? (snap.get(l.planLineId) ?? null) : null;
      }
    }

    const groups = new Map<string, { source: ResolvedSource; lines: Line[] }>();
    for (const line of lines) {
      const key = this.sourceKey(line.source);
      const group = groups.get(key) ?? { source: line.source, lines: [] };
      group.lines.push(line);
      groups.set(key, group);
    }

    // Resolve pricing/nutrition + validate stock for every group BEFORE the transaction — same
    // "fail fast before creating the distribution row" pattern `create()`/`assertSufficientStock`
    // use elsewhere in this module. A shortfall on any one source aborts the whole confirm, no
    // partial write.
    const groupPlans = await Promise.all(
      [...groups.values()].map(async ({ source, lines: groupLines }) => {
        const totalKg = round2(
          groupLines.reduce((sum, l) => sum + l.offeredKg, 0),
        );
        const totalRefusalKg = round2(
          groupLines.reduce((sum, l) => sum + l.refusalKg, 0),
        );
        const plan = await this.resolveGroupPlan(
          farmId,
          userId,
          source,
          totalKg,
        );
        return { source, lines: groupLines, totalKg, totalRefusalKg, ...plan };
      }),
    );

    const totalKg = round2(groupPlans.reduce((sum, g) => sum + g.totalKg, 0));
    const created = await this.prisma.$transaction(async (tx) => {
      // RAKHAL-446: a purchased-feed source is drawn FIFO from its real lots, so one cow's share can
      // span two lots. Each (cow, lot) pair becomes its own cow-line — exact lot cost, exact lot
      // nutrition profile, exact lot to re-credit on void — and each lot gets one group-level line.
      // Re-planned here inside the transaction so the lots are the ones actually about to be drawn.
      type CowPiece = {
        cattleId: string;
        offeredKg: number;
        refusalKg: number;
        source: ResolvedSource;
        costTk: number;
        feedName: string;
        snapshot: NutrientSnapshot;
        feedItemBatchId: string | null;
        nutritionProfileId: string | null;
        draw: { batchId: string; units: number } | null;
        plan: PlanSnap | null;
      };
      type LotLine = {
        ingredientId: string;
        ingredientName: string;
        kg: number;
        refusalKg: number;
        costTk: number;
        snapshot: NutrientSnapshot;
        feedItemBatchId: string | null;
        nutritionProfileId: string | null;
      };
      const cowPieces: CowPiece[] = [];
      const lotLines: LotLine[] = [];

      for (const g of groupPlans) {
        if (g.source.sourceType !== 'FEED_ITEM') {
          lotLines.push({
            ingredientId: g.ingredientId,
            ingredientName: g.ingredientName,
            kg: g.totalKg,
            refusalKg: g.totalRefusalKg,
            costTk: round2(g.totalKg * g.pricePerKg),
            snapshot: g.nutritionSnapshot,
            feedItemBatchId: null,
            nutritionProfileId: null,
          });
          for (const l of g.lines) {
            cowPieces.push({
              cattleId: l.cattleId,
              offeredKg: l.offeredKg,
              refusalKg: l.refusalKg,
              source: l.source,
              costTk: round2(l.offeredKg * g.pricePerKg),
              feedName: g.ingredientName,
              snapshot: g.nutritionSnapshot,
              feedItemBatchId: null,
              nutritionProfileId: null,
              draw: null,
              plan: l.plan ?? null,
            });
          }
          continue;
        }

        const usage = await this.feedDistribution.computeFeedItemUsage(
          farmId,
          g.source.feedItemId!,
          g.totalKg,
          tx,
        );
        const { kgPerUnit } = usage.plan;
        const lots = usage.plan.pieces.map((p) => ({
          ...p,
          remainingUnits: p.quantityUnits,
          kg: 0,
          refusalKg: 0,
          costTk: 0,
        }));
        for (const l of g.lines) {
          let needUnits = l.offeredKg / kgPerUnit;
          while (needUnits > 1e-9) {
            const lot = lots.find((x) => x.remainingUnits > 1e-9);
            if (!lot) break;
            const takeUnits = Math.min(needUnits, lot.remainingUnits);
            const kg = takeUnits * kgPerUnit;
            const share = l.offeredKg > 0 ? kg / l.offeredKg : 0;
            const cost = takeUnits * lot.costPerUnit;
            cowPieces.push({
              cattleId: l.cattleId,
              offeredKg: round2(kg),
              refusalKg: round2(l.refusalKg * share),
              source: l.source,
              costTk: round2(cost),
              feedName: g.ingredientName,
              snapshot: snapshotOf(this.lotResolver.toValues(lot.profile)),
              feedItemBatchId: lot.batchId,
              nutritionProfileId: lot.nutritionProfileId,
              draw: { batchId: lot.batchId, units: takeUnits },
              plan: l.plan
                ? { ...l.plan, plannedKg: round2(l.plan.plannedKg * share) }
                : null,
            });
            lot.remainingUnits -= takeUnits;
            lot.kg += kg;
            lot.refusalKg += l.refusalKg * share;
            lot.costTk += cost;
            needUnits -= takeUnits;
          }
        }
        for (const lot of lots) {
          if (lot.kg <= 0) continue;
          lotLines.push({
            ingredientId: g.ingredientId,
            ingredientName: g.ingredientName,
            kg: round2(lot.kg),
            refusalKg: round2(lot.refusalKg),
            costTk: round2(lot.costTk),
            snapshot: snapshotOf(this.lotResolver.toValues(lot.profile)),
            feedItemBatchId: lot.batchId,
            nutritionProfileId: lot.nutritionProfileId,
          });
        }
      }

      const actualCost = round2(lotLines.reduce((s, l) => s + l.costTk, 0));
      const dist = await tx.feedDistribution.create({
        data: {
          farmId,
          concentrationId: null,
          sourceType: 'FEEDING_GRID',
          cattleId: null,
          distributedAt: logDate,
          totalPlannedKg: totalKg,
          totalActualKg: totalKg,
          totalRefusalKg: round2(
            groupPlans.reduce((sum, g) => sum + g.totalRefusalKg, 0),
          ),
          totalPlannedCost: actualCost,
          totalActualCost: actualCost,
          createdBy: userId,
          items: {
            create: lotLines.map((l) => ({
              ingredientId: l.ingredientId,
              ingredientName: l.ingredientName,
              plannedKg: l.kg,
              actualKg: l.kg,
              refusalKg: l.refusalKg,
              pricePerKg: l.kg > 0 ? round2(l.costTk / l.kg) : 0,
              lineCost: l.costTk,
              feedItemBatchId: l.feedItemBatchId,
              nutritionProfileId: l.nutritionProfileId,
              ...(l.snapshot ?? {}),
            })),
          },
        },
        include: { items: true },
      });
      // RAKHAL-441 — one cow-line per (cow, lot); `costTk` is exact (that lot's own cost).
      const cattleItems: FeedDistributionCattleItem[] = [];
      for (const p of cowPieces) {
        const row = await tx.feedDistributionCattleItem.create({
          data: {
            distributionId: dist.id,
            cattleId: p.cattleId,
            offeredKg: p.offeredKg,
            refusalKg: p.refusalKg,
            sourceType: p.source.sourceType,
            feedItemId: p.source.feedItemId,
            feedStockId: p.source.feedStockId,
            costTk: p.costTk,
            feedName: p.feedName,
            feedItemBatchId: p.feedItemBatchId,
            nutritionProfileId: p.nutritionProfileId,
            feedPlanId: p.plan?.planId ?? null,
            feedPlanLineId: p.plan?.planLineId ?? null,
            plannedKg: p.plan?.plannedKg ?? null,
            ...(p.snapshot ?? {}),
          },
        });
        cattleItems.push(row);
        if (p.draw && p.source.feedItemId) {
          await this.feedItems.applyFeedDraw(
            farmId,
            userId,
            p.source.feedItemId,
            {
              batchId: p.draw.batchId,
              quantityUnits: p.draw.units,
              distributionId: dist.id,
              cattleItemId: row.id,
            },
            tx,
          );
        }
      }
      for (const { source, lines: groupLines } of groups.values()) {
        await tx.feedFeedingDraft.deleteMany({
          where: {
            farmId,
            logDate,
            sourceType: source.sourceType,
            feedItemId: source.feedItemId,
            feedStockId: source.feedStockId,
            cattleId: { in: groupLines.map((l) => l.cattleId) },
          },
        });
      }
      for (const g of groupPlans) await g.applyStock(dist.id, tx);
      return { ...dist, cattleItems };
    });

    this.log.info('Feeding grid confirmed', {
      farmId,
      distributionId: created.id,
      date: dto.date,
      sources: groupPlans.length,
      cows: lines.length,
      totalKg,
    });

    return {
      id: created.id,
      date: dto.date,
      total_actual_kg: created.totalActualKg,
      total_actual_cost: created.totalActualCost,
      sources: groupPlans.map((g) => ({
        source_type: g.source.sourceType,
        feed_item_id: g.source.feedItemId,
        feed_stock_id: g.source.feedStockId,
        total_kg: g.totalKg,
      })),
      // One entry per cow — a cow whose share spanned two lots has two cow-lines, summed here.
      cows: [
        ...created.cattleItems
          .reduce((byCow, c) => {
            const prev = byCow.get(c.cattleId);
            byCow.set(c.cattleId, {
              cattle_id: c.cattleId,
              offered_kg: round2((prev?.offered_kg ?? 0) + c.offeredKg),
              refusal_kg: round2((prev?.refusal_kg ?? 0) + c.refusalKg),
              source_type: c.sourceType,
              feed_item_id: c.feedItemId,
              feed_stock_id: c.feedStockId,
              cost_tk: round2((prev?.cost_tk ?? 0) + (c.costTk ?? 0)),
            });
            return byCow;
          }, new Map<string, Record<string, unknown> & { offered_kg: number; refusal_kg: number; cost_tk: number }>())
          .values(),
      ],
    };
  }

  // ---- internals ------------------------------------------------------------

  private async validateSource(farmId: string, source: ResolvedSource) {
    if (source.sourceType === 'FEED_ITEM') {
      const item = await this.prisma.feedItem.findFirst({
        where: { id: source.feedItemId ?? undefined, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!item) throw new NotFoundException('Feed item not found');
    } else {
      const stock = await this.prisma.feedStock.findFirst({
        where: { id: source.feedStockId ?? undefined, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!stock) throw new NotFoundException('Feed stock lot not found');
    }
  }

  /**
   * RAKHAL-430: resolve one entry's own source, falling back to the call's top-level default when
   * the entry doesn't name its own. Returns `null` when neither resolves to anything — the caller
   * decides whether that's fatal (`saveDraft` always requires one) or just means "skip this cow"
   * (`confirm`, whose resolution has further fallbacks beyond an entry's own source).
   */
  private resolveEntrySource(
    dto: {
      sourceType?: FeedGridSourceType;
      feedItemId?: string;
      feedStockId?: string;
    },
    entry: {
      sourceType?: FeedGridSourceType;
      feedItemId?: string;
      feedStockId?: string;
    },
  ): ResolvedSource | null {
    const sourceType = entry.sourceType ?? dto.sourceType;
    if (!sourceType) return null;
    const from = entry.sourceType ? entry : dto;
    return {
      sourceType,
      feedItemId: sourceType === 'FEED_ITEM' ? (from.feedItemId ?? null) : null,
      feedStockId:
        sourceType === 'FEED_STOCK' ? (from.feedStockId ?? null) : null,
    };
  }

  private sourceKey(source: ResolvedSource): string {
    return `${source.sourceType}:${source.feedItemId ?? source.feedStockId}`;
  }

  /**
   * RAKHAL-430: the per-source half of `confirm()` — resolves pricing/nutrition and validates
   * stock for one group of cows sharing one source, exactly the single-source logic `confirm()`
   * used to run once inline, now callable once per distinct source. Throws (stock/`kg-per-unit`
   * shortfalls) before anything is written, same fail-fast convention as everywhere else in this
   * module — `confirm()` calls this for every group before opening its transaction.
   */
  private async resolveGroupPlan(
    farmId: string,
    userId: string,
    source: ResolvedSource,
    totalKg: number,
  ): Promise<{
    ingredientId: string;
    ingredientName: string;
    pricePerKg: number;
    nutritionSnapshot: NutrientSnapshot;
    /** Runs INSIDE the confirm transaction (RAKHAL-453/RD-105) so a failed decrement rolls back the distribution. */
    applyStock: (
      distributionId: string,
      tx: Prisma.TransactionClient,
    ) => Promise<void>;
  }> {
    if (source.sourceType === 'FEED_ITEM') {
      // Fail-fast validation + provisional price/nutrition only (RAKHAL-446): `confirm()` re-plans the
      // lots inside its transaction and writes the exact per-lot cost and profile snapshot itself.
      const usage = await this.feedDistribution.computeFeedItemUsage(
        farmId,
        source.feedItemId!,
        totalKg,
      );
      const nutritionSnapshot = snapshotOf(
        blendNutrition(
          usage.plan.pieces.map((p) => ({
            kg: p.quantityKg,
            values: this.lotResolver.toValues(p.profile),
          })),
        ),
      );
      return {
        ingredientId: usage.ingredientId,
        ingredientName: usage.ingredientName,
        pricePerKg: usage.pricePerKg,
        nutritionSnapshot,
        applyStock: async () => {},
      };
    }

    const stock = await this.prisma.feedStock.findFirst({
      where: { id: source.feedStockId ?? undefined, farmId, deletedAt: null },
      include: { nutritionProfile: true },
    });
    if (!stock) throw new NotFoundException('Feed stock lot not found');
    const p = stock.nutritionProfile;
    await this.feedStock.assertSufficientStock(farmId, [
      { stockId: stock.id, quantity: totalKg },
    ]);
    // A `FeedStock` lot carries its own nutrition-of-record (its `NutritionProfile`, RAKHAL-327/451) —
    // freeze that directly rather than re-deriving from the concentration's live recipe.
    const nutritionSnapshot: NutrientSnapshot = snapshotOf(
      this.lotResolver.toValues(p),
    );
    // Show the real recipe name, not a bare batch id — a `FeedStock` lot has no name of its own,
    // only the `FeedConcentration` it was produced from does. Fall back to the batch id only when
    // that recipe has since been hard-deleted (rare; `finalize()` never cascades a delete here).
    const recipe = await this.prisma.feedConcentration.findFirst({
      where: { id: stock.sourceConcentrationId },
      select: { name: true },
    });
    return {
      ingredientId: stock.sourceConcentrationId,
      ingredientName: recipe?.name ?? `Batch ${stock.id}`,
      pricePerKg:
        stock.producedQtyKg > 0
          ? round2(stock.producedCostTk / stock.producedQtyKg)
          : 0,
      nutritionSnapshot,
      applyStock: async (distributionId: string, tx) => {
        await this.feedStock.decrementForDistribution(
          farmId,
          userId,
          { stockId: stock.id, quantity: totalKg, distributionId },
          tx,
        );
      },
    };
  }

  /** RAKHAL-441 frontend twin (per-cow) — one cow's own feeding entries for exactly one day
   * (defaults to today when `date` is omitted), including voided rows (rendered struck-through,
   * not hidden — this is also the correction audit trail for that cow). Carries the ids
   * (`distribution_id`/`id`) the void route needs, which `GET /feed/grid` deliberately doesn't
   * expose (it only sums a per-cow total via `confirmed_offered_kg`). */
  async cattleHistory(farmId: string, cattleId: string, date?: string) {
    const found = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Cattle not found');

    const logDate = await this.clock.dayStart(farmId, date);
    const rows = await this.prisma.feedDistributionCattleItem.findMany({
      where: {
        cattleId,
        // RAKHAL-453/RD-108: this is the Feeding Grid's history — exclude legacy/ration distributions.
        distribution: {
          farmId,
          distributedAt: logDate,
          sourceType: 'FEEDING_GRID',
        },
      },
      include: { distribution: { select: { createdAt: true } } },
      orderBy: { id: 'desc' },
    });
    // Nutrition totals actually fed this day, over active (non-voided) rows only — same
    // null-skip convention `getDmiComparison()` already established for `dmPct` (frozen snapshot,
    // never backfilled). rdp/rup are % of CP, not DM, so they chain off each row's own computed
    // CP kg rather than off DM kg directly.
    const active = rows.filter((r) => r.voidedAt == null);
    const dmKgOf = (r: (typeof rows)[number]) =>
      r.dmPct == null ? null : r.offeredKg * (r.dmPct / 100);
    const sumPctOfDm = (
      pctField:
        | 'cpPct'
        | 'fatPct'
        | 'ndfPct'
        | 'adfPct'
        | 'starchPct'
        | 'tdnPct'
        | 'calciumPct'
        | 'phosphorusPct',
    ) =>
      active.reduce((sum, r) => {
        const dm = dmKgOf(r);
        const pct = r[pctField];
        if (dm == null || pct == null) return sum;
        return sum + dm * (pct / 100);
      }, 0);

    const totalDmKg = active.reduce((sum, r) => sum + (dmKgOf(r) ?? 0), 0);
    const totalMeMj = active.reduce((sum, r) => {
      const dm = dmKgOf(r);
      if (dm == null || r.meMjPerKgDm == null) return sum;
      return sum + dm * r.meMjPerKgDm;
    }, 0);
    const rdpRup = active.reduce(
      (acc, r) => {
        const dm = dmKgOf(r);
        if (dm == null || r.cpPct == null) return acc;
        const cpKgLine = dm * (r.cpPct / 100);
        if (r.rdpPct != null) acc.rdp += cpKgLine * (r.rdpPct / 100);
        if (r.rupPct != null) acc.rup += cpKgLine * (r.rupPct / 100);
        return acc;
      },
      { rdp: 0, rup: 0 },
    );

    // A nutrient no fed row carries is "not measured", not "0 kg" — feeds seeded without ADF/TDN/starch/Ca/P/RDP/RUP
    // would otherwise read as if the cow got none of it.
    const anyMeasured = (pctField: string) =>
      active.some(
        (r) =>
          r.dmPct != null && (r as Record<string, unknown>)[pctField] != null,
      );
    const measured = {
      dm_kg: active.some((r) => r.dmPct != null),
      cp_kg: anyMeasured('cpPct'),
      me_mj: active.some((r) => r.dmPct != null && r.meMjPerKgDm != null),
      fat_kg: anyMeasured('fatPct'),
      ndf_kg: anyMeasured('ndfPct'),
      adf_kg: anyMeasured('adfPct'),
      starch_kg: anyMeasured('starchPct'),
      tdn_kg: anyMeasured('tdnPct'),
      calcium_kg: anyMeasured('calciumPct'),
      phosphorus_kg: anyMeasured('phosphorusPct'),
      rdp_kg: active.some((r) => r.cpPct != null && r.rdpPct != null),
      rup_kg: active.some((r) => r.cpPct != null && r.rupPct != null),
    };

    // What she needs that day — the SAME resolver the cow profile and the grid use (a manual override wins), so the
    // sheet, the profile and the grid can never disagree. Full profile, not just DM/CP/ME.
    const dateKey = this.dateOnly(logDate);
    const required = (
      await this.requirements.forCattle(farmId, [cattleId], dateKey)
    ).cows[0];

    return {
      cattle_id: cattleId,
      date: dateKey,
      requirement: required
        ? { ...required.requirements, source: required.source }
        : null,
      measured,
      entries: rows.map((r) => ({
        id: r.id,
        distribution_id: r.distributionId,
        offered_kg: r.offeredKg,
        refusal_kg: r.refusalKg,
        cost_tk: r.costTk,
        feed_name: r.feedName,
        source_type: r.sourceType,
        // Real time-of-day this was confirmed — `distributedAt` on the parent is day-only
        // (midnight-normalized), so the per-cow item row has no time of its own to read; the
        // distribution's own `createdAt` is the actual confirm timestamp for every cow in it.
        fed_at: r.distribution.createdAt,
        voided_at: r.voidedAt,
        voided_by: r.voidedBy,
        void_reason: r.voidReason,
      })),
      totals: {
        dm_kg: round2(totalDmKg),
        cp_kg: round2(sumPctOfDm('cpPct')),
        me_mj: round2(totalMeMj),
        fat_kg: round2(sumPctOfDm('fatPct')),
        ndf_kg: round2(sumPctOfDm('ndfPct')),
        adf_kg: round2(sumPctOfDm('adfPct')),
        starch_kg: round2(sumPctOfDm('starchPct')),
        tdn_kg: round2(sumPctOfDm('tdnPct')),
        calcium_kg: round2(sumPctOfDm('calciumPct')),
        phosphorus_kg: round2(sumPctOfDm('phosphorusPct')),
        rdp_kg: round2(rdpRup.rdp),
        rup_kg: round2(rdpRup.rup),
      },
    };
  }

  /** RAKHAL-441 §5 — void exactly one cow's line from a confirmed Feeding Grid distribution.
   * Exact, not proportional: this row already names its own exact stock source and its own exact
   * cost, so reversing it is a direct subtraction, not an estimate. Idempotent — voiding an
   * already-voided row is a no-op success, not an error. Never deletes the row — the audit trail
   * (`voidedAt`/`voidedBy`/`voidReason`) survives forever, same convention `Expense.voidedAt`
   * uses elsewhere in this codebase. */
  async voidCattleItem(
    farmId: string,
    userId: string,
    distributionId: string,
    cattleItemId: string,
    dto: VoidFeedCattleItemDto,
  ) {
    const item = await this.prisma.feedDistributionCattleItem.findFirst({
      where: { id: cattleItemId, distributionId, distribution: { farmId } },
      include: {
        distribution: { include: { items: true, cattleItems: true } },
      },
    });
    if (!item) throw new NotFoundException('Feeding record not found');

    if (item.voidedAt) {
      // Idempotent no-op — a replayed void must not credit stock back a second time.
      return {
        id: item.id,
        cattle_id: item.cattleId,
        offered_kg: item.offeredKg,
        voided_at: item.voidedAt,
        voided_by: item.voidedBy,
        void_reason: item.voidReason,
      };
    }

    const dist = item.distribution;
    const costTk = item.costTk ?? 0;

    // Re-derive this cow's own source's catalogue `ingredientId` (same lookups
    // `resolveGroupPlan` makes) to find the sibling `FeedDistributionItem` to shrink —
    // `FeedDistributionItem` is keyed by `ingredientId`, not `feedItemId`/`feedStockId`.
    // RAKHAL-446: a purchased-feed cow-line names its lot, and the group-level line for that lot
    // carries the same `feedItemBatchId` — that is the sibling. Rows written before lots existed have
    // no `feedItemBatchId` and fall back to the ingredient key.
    let siblingItem = item.feedItemBatchId
      ? dist.items.find((i) => i.feedItemBatchId === item.feedItemBatchId)
      : undefined;
    if (!siblingItem) {
      let ingredientId: string;
      if (item.sourceType === 'FEED_ITEM') {
        const feedItem = await this.prisma.feedItem.findFirst({
          where: { id: item.feedItemId ?? undefined, farmId },
          select: { id: true, ingredientId: true },
        });
        if (!feedItem) throw new NotFoundException('Feed item not found');
        ingredientId = feedItem.ingredientId ?? feedItem.id;
      } else {
        const stock = await this.prisma.feedStock.findFirst({
          where: { id: item.feedStockId ?? undefined, farmId },
          select: { sourceConcentrationId: true },
        });
        if (!stock) throw new NotFoundException('Feed stock lot not found');
        ingredientId = stock.sourceConcentrationId;
      }
      siblingItem = dist.items.find((i) => i.ingredientId === ingredientId);
    }
    if (!siblingItem) {
      throw new NotFoundException('Distribution line not found');
    }
    const sibling = siblingItem;

    const result = await this.prisma.$transaction(async (tx) => {
      // Conditional update guards against a concurrent double-void the same way
      // `decrementForDistribution`'s own `updateMany` guard does — a second racing call sees
      // `count === 0` and the credit-back below never double-applies.
      const applied = await tx.feedDistributionCattleItem.updateMany({
        where: { id: item.id, voidedAt: null },
        data: {
          voidedAt: new Date(),
          voidedBy: userId,
          voidReason: dto.reason ?? null,
        },
      });
      if (applied.count === 0) {
        return this.prisma.feedDistributionCattleItem.findUniqueOrThrow({
          where: { id: item.id },
        });
      }

      if (item.sourceType === 'FEED_ITEM' && item.feedItemId) {
        await this.feedItems.restoreFeedDraw(
          farmId,
          userId,
          {
            cattleItemId: item.id,
            fallbackFeedItemId: item.feedItemId,
            fallbackQuantityKg: item.offeredKg,
            notes: dto.reason ?? 'Feeding voided',
          },
          tx,
        );
      } else if (item.sourceType === 'FEED_STOCK' && item.feedStockId) {
        await tx.feedStock.update({
          where: { id: item.feedStockId },
          data: { currentStockKg: { increment: item.offeredKg } },
        });
        await tx.feedStockMovement.create({
          data: {
            stockId: item.feedStockId,
            changeKg: round2(item.offeredKg),
            reason: 'ADJUSTMENT',
            distributionId: dist.id,
            createdBy: userId,
          },
        });
      }

      await tx.feedDistributionItem.update({
        where: { id: sibling.id },
        data: {
          actualKg: round2(sibling.actualKg - item.offeredKg),
          refusalKg: round2(sibling.refusalKg - item.refusalKg),
          lineCost: round2(sibling.lineCost - costTk),
        },
      });
      await tx.feedDistribution.update({
        where: { id: dist.id },
        data: {
          totalActualKg: round2(dist.totalActualKg - item.offeredKg),
          totalRefusalKg: round2(dist.totalRefusalKg - item.refusalKg),
          totalActualCost: round2(dist.totalActualCost - costTk),
        },
      });

      const remainingActive = dist.cattleItems.filter(
        (c) => c.id !== item.id && c.voidedAt == null,
      );
      if (remainingActive.length === 0) {
        await tx.feedDistribution.update({
          where: { id: dist.id },
          data: { voidedAt: new Date() },
        });
      }

      return tx.feedDistributionCattleItem.findUniqueOrThrow({
        where: { id: item.id },
      });
    });

    this.log.info('Feeding grid cattle item voided', {
      farmId,
      distributionId,
      cattleItemId,
      offeredKg: item.offeredKg,
      costTk,
    });

    return {
      id: result.id,
      cattle_id: result.cattleId,
      offered_kg: result.offeredKg,
      voided_at: result.voidedAt,
      voided_by: result.voidedBy,
      void_reason: result.voidReason,
    };
  }

  private async assertCattleBelongToFarm(farmId: string, cattleIds: string[]) {
    const ids = [...new Set(cattleIds)];
    const found = await this.prisma.cattle.count({
      where: { id: { in: ids }, ...activeHerd(farmId) },
    });
    if (found !== ids.length) {
      throw new BadRequestException(
        'One or more cattle do not belong to this farm',
      );
    }
  }

  /**
   * "Yesterday's per-head value carries forward as today's default" — the most recent confirmed
   * `FeedDistributionCattleItem` per cow, regardless of which exact prior date it was logged on.
   * Fetched once per `cattleIds` batch and reduced in JS to the first (most recent, thanks to the
   * `distributedAt desc` ordering) row per cow — simpler and safer than relying on Prisma's
   * relation-ordered `distinct` for a modest per-farm herd size.
   */
  private async computeDefaults(
    farmId: string,
    cattleIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.feedDistributionCattleItem.findMany({
      where: {
        cattleId: { in: cattleIds },
        // RAKHAL-453/RD-104: a voided feeding must never carry forward as tomorrow's default.
        voidedAt: null,
        distribution: { farmId, voidedAt: null },
      },
      select: {
        cattleId: true,
        offeredKg: true,
        distribution: { select: { distributedAt: true } },
      },
      orderBy: { distribution: { distributedAt: 'desc' } },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      if (!map.has(row.cattleId)) map.set(row.cattleId, row.offeredKg);
    }
    return map;
  }

  /**
   * RAKHAL-440/RD-099: how much of `logDate` is *already confirmed* for each cow, as distinct from
   * `computeDefaults()`'s carried-forward suggestion (which reads the most recent confirmed day,
   * any date, and renders identically whether or not today itself has been touched — the actual bug
   * report: a farmer fed a cow yesterday, didn't feed her today, and the grid still showed
   * yesterday's `1kg` with no way to tell the two states apart). Summed per cow rather than a single
   * row, since nothing stops `confirm()` being called twice for the same date (e.g. a real AM/PM
   * split logged as two separate confirms) — each would be its own `FeedDistributionCattleItem`.
   */
  private async computeConfirmedToday(
    cattleIds: string[],
    farmId: string,
    logDate: Date,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.feedDistributionCattleItem.findMany({
      where: {
        cattleId: { in: cattleIds },
        // RAKHAL-453/RD-104: a voided feeding is not "confirmed today".
        voidedAt: null,
        distribution: { farmId, distributedAt: logDate, voidedAt: null },
      },
      select: { cattleId: true, offeredKg: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(
        row.cattleId,
        round2((map.get(row.cattleId) ?? 0) + row.offeredKg),
      );
    }
    return map;
  }

  /**
   * What today's CONFIRMED (non-voided) feedings supplied each cow, from the nutrition profile frozen on each row
   * (RAKHAL-446): Σ offeredKg × DM% → DM kg, × CP% → CP kg, × ME MJ/kg DM → ME MJ. Backs the grid's requirement bar,
   * which fills only after feeding is confirmed. `complete` is false when a row has no profile (pre-446 data).
   */
  private async computeConfirmedSupply(
    cattleIds: string[],
    farmId: string,
    logDate: Date,
  ): Promise<
    Map<
      string,
      { dm_kg: number; cp_kg: number; me_mj: number; complete: boolean }
    >
  > {
    const rows = await this.prisma.feedDistributionCattleItem.findMany({
      where: {
        cattleId: { in: cattleIds },
        voidedAt: null,
        distribution: { farmId, distributedAt: logDate, voidedAt: null },
      },
      select: { cattleId: true, offeredKg: true, nutritionProfileId: true },
    });
    const profiles = await this.lotResolver.profiles(
      farmId,
      rows.flatMap((r) => (r.nutritionProfileId ? [r.nutritionProfileId] : [])),
    );
    const acc = new Map<
      string,
      { dm_kg: number; cp_kg: number; me_mj: number; complete: boolean }
    >();
    for (const row of rows) {
      const cur = acc.get(row.cattleId) ?? {
        dm_kg: 0,
        cp_kg: 0,
        me_mj: 0,
        complete: true,
      };
      const p = row.nutritionProfileId
        ? profiles.get(row.nutritionProfileId)
        : undefined;
      if (!p) {
        cur.complete = false;
      } else {
        const dm = row.offeredKg * (p.dmPct / 100);
        cur.dm_kg += dm;
        cur.cp_kg += dm * (p.cpPct / 100);
        cur.me_mj += dm * p.meMjPerKgDm;
      }
      acc.set(row.cattleId, cur);
    }
    for (const v of acc.values()) {
      v.dm_kg = round2(v.dm_kg);
      v.cp_kg = round2(v.cp_kg);
      v.me_mj = round2(v.me_mj);
    }
    return acc;
  }

  private mapResolvedSource(source: ResolvedSource | undefined | null) {
    if (!source) return null;
    return {
      source_type: source.sourceType,
      feed_item_id: source.feedItemId,
      feed_stock_id: source.feedStockId,
    };
  }

  /**
   * RAKHAL-431: resolution ladder — **own last-used → none** — surfaced as `default_source` on
   * `GET /feed/grid` (parallel to `default_offered_kg`). Batched over the whole `cattle` list
   * passed in rather than resolved per cow, so the grid stays a handful of queries regardless of
   * herd size.
   *
   * Own last-used is honored only past an **availability guard** — the resolved
   * `FeedItem`/`FeedStock` must still exist, not be soft-deleted, and carry real stock (`> 0`).
   *
   * A `FeedStock` lot that fails the availability guard gets one more chance — **batch
   * fall-forward**: a sibling lot sharing the same `sourceConcentrationId` (same recipe, re-mixed)
   * that does have stock. Otherwise the cow has no default source.
   */
  private async resolveDefaultSources(
    farmId: string,
    cattle: { id: string }[],
  ): Promise<Map<string, ResolvedSource | null>> {
    const cattleIds = cattle.map((c) => c.id);
    const lastUsedByCattle = await this.computeLastUsedSources(
      farmId,
      cattleIds,
    );

    const feedItemIds = new Set<string>();
    const feedStockIds = new Set<string>();
    for (const lu of lastUsedByCattle.values()) {
      if (lu.feedItemId) feedItemIds.add(lu.feedItemId);
      if (lu.feedStockId) feedStockIds.add(lu.feedStockId);
    }

    const [items, stocks] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { id: { in: [...feedItemIds] }, farmId },
        select: {
          id: true,
          deletedAt: true,
          // RAKHAL-450: stock lives on the lots.
          batches: {
            where: { deletedAt: null },
            select: { currentStock: true },
          },
        },
      }),
      this.prisma.feedStock.findMany({
        where: { id: { in: [...feedStockIds] }, farmId },
        select: {
          id: true,
          currentStockKg: true,
          deletedAt: true,
          sourceConcentrationId: true,
        },
      }),
    ]);
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const stockMap = new Map(stocks.map((s) => [s.id, s]));

    const exhaustedRecipeIds = new Set<string>();
    for (const stock of stocks) {
      if (stock.deletedAt || stock.currentStockKg <= 0) {
        exhaustedRecipeIds.add(stock.sourceConcentrationId);
      }
    }
    const siblingsByRecipe = new Map<string, { id: string }>();
    if (exhaustedRecipeIds.size) {
      const siblings = await this.prisma.feedStock.findMany({
        where: {
          farmId,
          sourceConcentrationId: { in: [...exhaustedRecipeIds] },
          deletedAt: null,
          currentStockKg: { gt: 0 },
        },
        select: { id: true, sourceConcentrationId: true },
        orderBy: { producedAt: 'desc' },
      });
      for (const s of siblings) {
        if (!siblingsByRecipe.has(s.sourceConcentrationId)) {
          siblingsByRecipe.set(s.sourceConcentrationId, { id: s.id });
        }
      }
    }

    const result = new Map<string, ResolvedSource | null>();
    for (const c of cattle) {
      const lastUsed = lastUsedByCattle.get(c.id);

      if (lastUsed?.sourceType === 'FEED_ITEM') {
        const item = lastUsed.feedItemId
          ? itemMap.get(lastUsed.feedItemId)
          : undefined;
        if (
          item &&
          !item.deletedAt &&
          item.batches.some((b) => b.currentStock > 0)
        ) {
          result.set(c.id, {
            sourceType: 'FEED_ITEM',
            feedItemId: lastUsed.feedItemId,
            feedStockId: null,
          });
          continue;
        }
      } else if (lastUsed?.sourceType === 'FEED_STOCK') {
        const stock = lastUsed.feedStockId
          ? stockMap.get(lastUsed.feedStockId)
          : undefined;
        if (stock && !stock.deletedAt && stock.currentStockKg > 0) {
          result.set(c.id, {
            sourceType: 'FEED_STOCK',
            feedItemId: null,
            feedStockId: lastUsed.feedStockId,
          });
          continue;
        }
        const sibling = stock
          ? siblingsByRecipe.get(stock.sourceConcentrationId)
          : undefined;
        if (sibling) {
          result.set(c.id, {
            sourceType: 'FEED_STOCK',
            feedItemId: null,
            feedStockId: sibling.id,
          });
          continue;
        }
      }

      result.set(c.id, null);
    }
    return result;
  }

  /** Most recent `FeedDistributionCattleItem` per cow that carries its own source (RAKHAL-430
   * onward — pre-RAKHAL-430 rows have no source columns and are skipped, not treated as "no
   * source"). Reduced in JS to the first row per cow after a `distributedAt desc` ordering, same
   * approach as `computeDefaults`. */
  private async computeLastUsedSources(
    farmId: string,
    cattleIds: string[],
  ): Promise<
    Map<
      string,
      {
        sourceType: FeedGridSourceType;
        feedItemId: string | null;
        feedStockId: string | null;
      }
    >
  > {
    const rows = await this.prisma.feedDistributionCattleItem.findMany({
      where: {
        cattleId: { in: cattleIds },
        distribution: { farmId },
        sourceType: { not: null },
      },
      select: {
        cattleId: true,
        sourceType: true,
        feedItemId: true,
        feedStockId: true,
        distribution: { select: { distributedAt: true } },
      },
      orderBy: { distribution: { distributedAt: 'desc' } },
    });
    const map = new Map<
      string,
      {
        sourceType: FeedGridSourceType;
        feedItemId: string | null;
        feedStockId: string | null;
      }
    >();
    for (const row of rows) {
      if (!map.has(row.cattleId) && row.sourceType) {
        map.set(row.cattleId, {
          sourceType: row.sourceType,
          feedItemId: row.feedItemId,
          feedStockId: row.feedStockId,
        });
      }
    }
    return map;
  }

  private groupByCattle<T extends { cattleId: string }>(
    rows: T[],
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.cattleId) ?? [];
      list.push(row);
      map.set(row.cattleId, list);
    }
    return map;
  }

  private mapDraft(row: {
    id: string;
    sourceType: FeedGridSourceType;
    feedItemId: string | null;
    feedStockId: string | null;
    offeredKg: number;
    refusalKg: number | null;
    feedPlanLineId: string | null;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      source_type: row.sourceType,
      feed_item_id: row.feedItemId,
      feed_stock_id: row.feedStockId,
      offered_kg: row.offeredKg,
      refusal_kg: row.refusalKg,
      plan_line_id: row.feedPlanLineId,
      updated_at: row.updatedAt,
    };
  }

  private dayStart(dateStr: string): Date {
    const d = new Date(dateStr);
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private dateOnly(day: Date): string {
    return day.toISOString().slice(0, 10);
  }
}
