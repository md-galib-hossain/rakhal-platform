import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedGridSourceType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { FeedDistributionService } from './feed-distribution.service';
import { FeedStockService } from './feed-stock.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
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
  fatPct: number;
  ndfPct: number;
  rdpPct: number;
  rupPct: number;
  starchPct: number;
  adfPct: number;
  calciumPct: number;
  phosphorusPct: number;
  tdnPct: number;
} | null;

/** RAKHAL-430 (Feeding Favourites): one cow's/line's resolved feed source — always exactly one of
 * `feedItemId`/`feedStockId` set, matching `sourceType`. The unified shape `resolveEntrySource()`
 * returns and every per-source grouping/validation in `confirm()`/`saveDraft()` operates on. */
type ResolvedSource = {
  sourceType: FeedGridSourceType;
  feedItemId: string | null;
  feedStockId: string | null;
};

/**
 * Feeding Grid (2026-08-15) — replaces Quick Feed. A per-cow, spreadsheet-style feeding session:
 * a farmer opens the grid for a day (optionally scoped to one feed group), sees every cow with its
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
    private readonly farmSettings: FarmSettingsService,
  ) {
    this.log = logger.setContext(FeedFeedingGridService.name);
  }

  /**
   * RAKHAL-434: per-day feeding-entry status for the missed-entry calendar picker on the Feed
   * Grid page. Expected coverage per day is the set of distinct `feedGroupId`s among the active
   * herd (`null` = ungrouped cattle, only reachable by a whole-farm confirm). A whole-farm
   * confirm (`FeedDistribution.feedGroupId === null`) covers every group in one shot; a
   * per-group confirm only covers its own group. `complete` = full expected coverage that day,
   * `partial` = some, `missing` = none. Days before the farm existed or after today are never
   * `missing`.
   */
  async calendar(farmId: string, month: string) {
    const [year, m] = month.split('-').map(Number);
    const from = new Date(Date.UTC(year, m - 1, 1));
    const to = new Date(Date.UTC(year, m, 1));
    const today = this.dayStart(new Date().toISOString());

    const [farm, cattle, rows] = await Promise.all([
      this.prisma.farm.findUnique({
        where: { id: farmId },
        select: { createdAt: true },
      }),
      this.prisma.cattle.findMany({
        where: activeHerd(farmId),
        select: { feedGroupId: true },
      }),
      this.prisma.feedDistribution.findMany({
        where: {
          farmId,
          sourceType: 'FEEDING_GRID',
          distributedAt: { gte: from, lt: to },
        },
        select: { distributedAt: true, feedGroupId: true },
      }),
    ]);
    const farmCreatedDay = farm
      ? this.dayStart(farm.createdAt.toISOString())
      : null;
    const expectedGroups = new Set(
      cattle.map((c) => c.feedGroupId ?? '__ungrouped__'),
    );

    type Coverage = { farmWide: boolean; groups: Set<string> };
    const coverageByDay = new Map<string, Coverage>();
    for (const row of rows) {
      const key = this.dateOnly(row.distributedAt);
      const cov = coverageByDay.get(key) ?? {
        farmWide: false,
        groups: new Set<string>(),
      };
      if (row.feedGroupId == null) cov.farmWide = true;
      else cov.groups.add(row.feedGroupId);
      coverageByDay.set(key, cov);
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
      } else if (expectedGroups.size === 0) {
        status = 'missing';
      } else {
        const cov = coverageByDay.get(dateStr);
        if (!cov) {
          status = 'missing';
        } else if (cov.farmWide || cov.groups.size >= expectedGroups.size) {
          status = 'complete';
        } else if (cov.groups.size > 0) {
          status = 'partial';
        } else {
          status = 'missing';
        }
      }
      days.push({ date: dateStr, status });
    }

    return { month, days };
  }

  async getGrid(farmId: string, date: string, feedGroupId?: string) {
    if (feedGroupId) {
      const group = await this.prisma.feedGroup.findFirst({
        where: { id: feedGroupId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Feed group not found');
    }

    const logDate = this.dayStart(date);
    const cattle = await this.prisma.cattle.findMany({
      where: {
        ...activeHerd(farmId),
        ...(feedGroupId ? { feedGroupId } : {}),
      },
      select: { id: true, name: true, tagNumber: true, feedGroupId: true },
      orderBy: { tagNumber: 'asc' },
    });
    const cattleIds = cattle.map((c) => c.id);
    if (cattleIds.length === 0) {
      return { date: date, feed_group_id: feedGroupId ?? null, cows: [] };
    }

    const [drafts, defaults, defaultSources, confirmedToday] =
      await Promise.all([
        this.prisma.feedFeedingDraft.findMany({
          where: { farmId, cattleId: { in: cattleIds }, logDate },
        }),
        this.computeDefaults(farmId, cattleIds),
        this.resolveDefaultSources(farmId, cattle),
        this.computeConfirmedToday(cattleIds, farmId, logDate),
      ]);
    const draftsByCattle = this.groupByCattle(drafts);

    return {
      date,
      feed_group_id: feedGroupId ?? null,
      cows: cattle.map((c) => ({
        cattle_id: c.id,
        name: c.name,
        tag_number: c.tagNumber,
        feed_group_id: c.feedGroupId,
        drafts: (draftsByCattle.get(c.id) ?? []).map((d) => this.mapDraft(d)),
        default_offered_kg: defaults.get(c.id) ?? null,
        default_source: this.mapResolvedSource(defaultSources.get(c.id)),
        confirmed_offered_kg: confirmedToday.get(c.id) ?? null,
      })),
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
   * A `create` that loses that race throws Prisma `P2002`, caught below and recovered as an update
   * of the row the other request just won — never a 500, never a silent duplicate.
   */
  async saveDraft(farmId: string, userId: string, dto: SaveFeedDraftDto) {
    const logDate = this.dayStart(dto.date);
    const cattleIds = dto.entries.map((e) => e.cattleId);
    await this.assertCattleBelongToFarm(farmId, cattleIds);

    const resolved = dto.entries.map((entry) => {
      const source = this.resolveEntrySource(dto, entry);
      if (!source) {
        throw new BadRequestException(
          `Cattle ${entry.cattleId} needs a source — either its own sourceType or the call's top-level sourceType`,
        );
      }
      return { entry, source };
    });

    const distinctSources = new Map<string, ResolvedSource>();
    for (const { source } of resolved) {
      distinctSources.set(this.sourceKey(source), source);
    }
    for (const source of distinctSources.values()) {
      await this.validateSource(farmId, source);
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const rows: Prisma.FeedFeedingDraftGetPayload<object>[] = [];
      for (const { entry, source } of resolved) {
        const existing = await tx.feedFeedingDraft.findFirst({
          where: {
            farmId,
            cattleId: entry.cattleId,
            logDate,
            sourceType: source.sourceType,
            feedItemId: source.feedItemId,
            feedStockId: source.feedStockId,
          },
        });
        const row = existing
          ? await tx.feedFeedingDraft.update({
              where: { id: existing.id },
              data: { offeredKg: round2(entry.offeredKg) },
            })
          : await this.createOrRecoverDraft(tx, {
              farmId,
              cattleId: entry.cattleId,
              feedGroupId: dto.feedGroupId,
              logDate,
              source,
              offeredKg: round2(entry.offeredKg),
              userId,
            });
        rows.push(row);
      }
      return rows;
    });

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
   * is *exactly* the cows named there — nothing else. Without entries, scope is the full grid for
   * `{feedGroupId}` (or the whole active herd if omitted), matching `getGrid()`, so a bare confirm
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
    if (dto.feedGroupId) {
      const group = await this.prisma.feedGroup.findFirst({
        where: { id: dto.feedGroupId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Feed group not found');
    }

    // RAKHAL-441 — a farm's owner controls which sessions are unlocked (same
    // `FarmSettingsService.milkActiveSessions` config Milk already enforces via its own
    // `assertSessionActive`) — reject a session the farm hasn't turned on, rather than silently
    // tagging every cow's row with a session nobody configured.
    if (dto.session) {
      const active = await this.farmSettings.milkActiveSessions(farmId);
      if (!active.includes(dto.session)) {
        throw new BadRequestException(
          `The ${dto.session.toLowerCase()} session is not enabled for this farm`,
        );
      }
    }

    const logDate = this.dayStart(dto.date);
    const cattle = await this.prisma.cattle.findMany({
      where: {
        ...activeHerd(farmId),
        ...(dto.feedGroupId ? { feedGroupId: dto.feedGroupId } : {}),
      },
      select: { id: true, feedGroupId: true },
    });
    const cattleIds = cattle.map((c) => c.id);
    if (cattleIds.length === 0) {
      throw new BadRequestException(
        'No cattle in scope to confirm feeding for',
      );
    }
    const currentGroupByCattle = new Map(
      cattle.map((c) => [c.id, c.feedGroupId]),
    );

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

    type Line = { cattleId: string; offeredKg: number; source: ResolvedSource };
    const lines: Line[] = [];
    for (const cattleId of scopedCattleIds) {
      const entry = entriesMap.get(cattleId);
      if (entry) {
        const source = this.resolveEntrySource(dto, entry);
        const qty = round2(entry.offeredKg);
        if (source && qty > 0) lines.push({ cattleId, offeredKg: qty, source });
        continue;
      }

      const cowDrafts = draftsByCattle.get(cattleId) ?? [];
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
            source: {
              sourceType: chosenDraft.sourceType,
              feedItemId: chosenDraft.feedItemId,
              feedStockId: chosenDraft.feedStockId,
            },
          });
        }
        continue;
      }

      if (dtoDefaultSource) {
        const qty = round2(defaults.get(cattleId) ?? 0);
        if (qty > 0) {
          lines.push({ cattleId, offeredKg: qty, source: dtoDefaultSource });
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
        const plan = await this.resolveGroupPlan(
          farmId,
          userId,
          source,
          totalKg,
        );
        return { source, lines: groupLines, totalKg, ...plan };
      }),
    );

    const totalKg = round2(groupPlans.reduce((sum, g) => sum + g.totalKg, 0));
    const totalCost = round2(
      groupPlans.reduce((sum, g) => sum + g.totalKg * g.pricePerKg, 0),
    );
    const targetFields = dto.feedGroupId
      ? { feedGroupId: dto.feedGroupId, cattleId: null }
      : { feedGroupId: null, cattleId: null };

    const created = await this.prisma.$transaction(async (tx) => {
      const dist = await tx.feedDistribution.create({
        data: {
          farmId,
          concentrationId: null,
          sourceType: 'FEEDING_GRID',
          ...targetFields,
          distributedAt: logDate,
          totalPlannedKg: totalKg,
          totalActualKg: totalKg,
          totalRefusalKg: 0,
          totalPlannedCost: totalCost,
          totalActualCost: totalCost,
          createdBy: userId,
          items: {
            create: groupPlans.map((g) => ({
              ingredientId: g.ingredientId,
              ingredientName: g.ingredientName,
              plannedKg: g.totalKg,
              actualKg: g.totalKg,
              refusalKg: 0,
              pricePerKg: g.pricePerKg,
              lineCost: round2(g.totalKg * g.pricePerKg),
              ...(g.nutritionSnapshot ?? {}),
            })),
          },
          cattleItems: {
            // RAKHAL-441 — mapped from `groupPlans` (not the flat `lines` array) so each cow's row
            // can carry its own group's exact resolved price/nutrition/name. `costTk` is exact, not
            // proportional — `resolveGroupPlan()` already priced this cow's own source, this is
            // just that same number times her own `offeredKg`.
            create: groupPlans.flatMap((g) =>
              g.lines.map((l) => ({
                cattleId: l.cattleId,
                offeredKg: l.offeredKg,
                sourceType: l.source.sourceType,
                feedItemId: l.source.feedItemId,
                feedStockId: l.source.feedStockId,
                feedGroupId: currentGroupByCattle.get(l.cattleId) ?? null,
                costTk: round2(l.offeredKg * g.pricePerKg),
                feedName: g.ingredientName,
                session: dto.session ?? null,
                ...(g.nutritionSnapshot ?? {}),
              })),
            ),
          },
        },
        include: { items: true, cattleItems: true },
      });
      for (const g of groupPlans) await g.applyDecrement(tx);
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
      return dist;
    });

    for (const g of groupPlans) await g.postCommit(created.id);

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
      feed_group_id: dto.feedGroupId ?? null,
      total_actual_kg: created.totalActualKg,
      total_actual_cost: created.totalActualCost,
      sources: groupPlans.map((g) => ({
        source_type: g.source.sourceType,
        feed_item_id: g.source.feedItemId,
        feed_stock_id: g.source.feedStockId,
        total_kg: g.totalKg,
      })),
      cows: created.cattleItems.map((c) => ({
        cattle_id: c.cattleId,
        offered_kg: c.offeredKg,
        source_type: c.sourceType,
        feed_item_id: c.feedItemId,
        feed_stock_id: c.feedStockId,
        cost_tk: c.costTk,
        session: c.session,
      })),
    };
  }

  // ---- internals ------------------------------------------------------------

  /**
   * RD-089: `saveDraft()`'s create branch, split out so the P2002 recovery reads clearly. Two
   * concurrent requests can both pass the caller's own `findFirst` (no row yet) before either
   * commits — the second `create` then collides with the partial unique index the first one just
   * satisfied and throws `P2002`. Recovered here as an update of the row the other request won,
   * rather than a 500 or (pre-RD-089) a silent duplicate row.
   */
  private async createOrRecoverDraft(
    tx: Prisma.TransactionClient,
    params: {
      farmId: string;
      cattleId: string;
      feedGroupId?: string;
      logDate: Date;
      source: ResolvedSource;
      offeredKg: number;
      userId: string;
    },
  ) {
    const {
      farmId,
      cattleId,
      feedGroupId,
      logDate,
      source,
      offeredKg,
      userId,
    } = params;
    try {
      return await tx.feedFeedingDraft.create({
        data: {
          farmId,
          cattleId,
          feedGroupId,
          logDate,
          sourceType: source.sourceType,
          feedItemId: source.feedItemId,
          feedStockId: source.feedStockId,
          offeredKg,
          createdBy: userId,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const winner = await tx.feedFeedingDraft.findFirstOrThrow({
          where: {
            farmId,
            cattleId,
            logDate,
            sourceType: source.sourceType,
            feedItemId: source.feedItemId,
            feedStockId: source.feedStockId,
          },
        });
        return tx.feedFeedingDraft.update({
          where: { id: winner.id },
          data: { offeredKg },
        });
      }
      throw e;
    }
  }

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
    applyDecrement: (tx: Prisma.TransactionClient) => Promise<void>;
    postCommit: (distributionId: string) => Promise<void>;
  }> {
    if (source.sourceType === 'FEED_ITEM') {
      const usage = await this.feedDistribution.computeFeedItemUsage(
        farmId,
        source.feedItemId!,
        totalKg,
      );
      // RAKHAL-327/328 follow-up: freeze the SAME live nutrition lookup used to price this line
      // (see `FeedDistributionService.create()`'s identical pattern) instead of leaving it to be
      // re-resolved from a possibly-later-edited catalogue every time `getDmiComparison()` runs.
      const eff = await this.feedDistribution.getEffectiveNutrition(
        farmId,
        usage.ingredientId,
      );
      const nutritionSnapshot: NutrientSnapshot = eff
        ? {
            dmPct: eff.dmPct,
            cpPct: eff.cpPct,
            meMjPerKgDm: eff.meMjPerKgDm,
            fatPct: eff.fatPct,
            ndfPct: eff.ndfPct,
            rdpPct: eff.rdpPct,
            rupPct: eff.rupPct,
            starchPct: eff.starchPct,
            adfPct: eff.adfPct,
            calciumPct: eff.calciumPct,
            phosphorusPct: eff.phosphorusPct,
            tdnPct: eff.tdnPct,
          }
        : null;
      return {
        ingredientId: usage.ingredientId,
        ingredientName: usage.ingredientName,
        pricePerKg: usage.pricePerKg,
        nutritionSnapshot,
        applyDecrement: async (tx) => {
          await tx.feedItem.update({
            where: { id: usage.feedItem.id },
            data: { currentStock: usage.newStock },
          });
        },
        postCommit: async () => {},
      };
    }

    const stock = await this.prisma.feedStock.findFirst({
      where: { id: source.feedStockId ?? undefined, farmId, deletedAt: null },
    });
    if (!stock) throw new NotFoundException('Feed stock lot not found');
    await this.feedStock.assertSufficientStock(farmId, [
      { stockId: stock.id, quantity: totalKg },
    ]);
    // A `FeedStock` lot already carries its own produce-time nutrient snapshot (`FeedStock.dmPct`
    // /etc, RAKHAL-327) — reuse it directly rather than re-deriving from the concentration's live
    // recipe.
    const nutritionSnapshot: NutrientSnapshot = {
      dmPct: stock.dmPct,
      cpPct: stock.cpPct,
      meMjPerKgDm: stock.meMjPerKgDm,
      fatPct: stock.fatPct,
      ndfPct: stock.ndfPct,
      rdpPct: stock.rdpPct,
      rupPct: stock.rupPct,
      starchPct: stock.starchPct,
      adfPct: stock.adfPct,
      calciumPct: stock.calciumPct,
      phosphorusPct: stock.phosphorusPct,
      tdnPct: stock.tdnPct,
    };
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
      applyDecrement: async () => {},
      postCommit: async (distributionId: string) => {
        await this.feedStock.decrementForDistribution(farmId, userId, {
          stockId: stock.id,
          quantity: totalKg,
          distributionId,
        });
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

    const logDate = this.dayStart(date ?? new Date().toISOString());
    const rows = await this.prisma.feedDistributionCattleItem.findMany({
      where: {
        cattleId,
        distribution: { farmId, distributedAt: logDate },
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

    return {
      cattle_id: cattleId,
      date: this.dateOnly(logDate),
      entries: rows.map((r) => ({
        id: r.id,
        distribution_id: r.distributionId,
        offered_kg: r.offeredKg,
        cost_tk: r.costTk,
        feed_name: r.feedName,
        source_type: r.sourceType,
        session: r.session,
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
    let ingredientId: string;
    if (item.sourceType === 'FEED_ITEM') {
      const feedItem = await this.prisma.feedItem.findFirst({
        where: { id: item.feedItemId ?? undefined, farmId },
        select: { id: true, ingredientId: true },
      });
      if (!feedItem) throw new NotFoundException('Feed item not found');
      // Same fallback `computeFeedItemUsage()` uses — an unlinked FeedItem (no catalogue
      // ingredient) resolves to its own id instead.
      ingredientId = feedItem.ingredientId ?? feedItem.id;
    } else {
      const stock = await this.prisma.feedStock.findFirst({
        where: { id: item.feedStockId ?? undefined, farmId },
        select: { sourceConcentrationId: true },
      });
      if (!stock) throw new NotFoundException('Feed stock lot not found');
      ingredientId = stock.sourceConcentrationId;
    }
    const siblingItem = dist.items.find((i) => i.ingredientId === ingredientId);
    if (!siblingItem)
      throw new NotFoundException('Distribution line not found');

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
        await tx.feedItem.update({
          where: { id: item.feedItemId },
          data: { currentStock: { increment: item.offeredKg } },
        });
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
        where: { id: siblingItem.id },
        data: {
          actualKg: round2(siblingItem.actualKg - item.offeredKg),
          lineCost: round2(siblingItem.lineCost - costTk),
        },
      });
      await tx.feedDistribution.update({
        where: { id: dist.id },
        data: {
          totalActualKg: round2(dist.totalActualKg - item.offeredKg),
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

  /** RAKHAL-441 frontend twin — the farm's own configured active feeding/milking sessions, for
   * the Grid UI's session picker. Same list Milk already uses (`FarmSettingsService
   * .milkActiveSessions`) — not a second, separate session concept. */
  async activeSessions(farmId: string) {
    return this.farmSettings.milkActiveSessions(farmId);
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
        distribution: { farmId },
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
        distribution: { farmId, distributedAt: logDate },
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

  private mapResolvedSource(source: ResolvedSource | undefined | null) {
    if (!source) return null;
    return {
      source_type: source.sourceType,
      feed_item_id: source.feedItemId,
      feed_stock_id: source.feedStockId,
    };
  }

  /**
   * RAKHAL-431: resolution ladder — **own last-used → feed-group default → none** — surfaced as
   * `default_source` on `GET /feed/grid` (parallel to `default_offered_kg`). Batched over the whole
   * `cattle` list passed in rather than resolved per cow, so the grid stays a handful of queries
   * regardless of herd size.
   *
   * Own last-used is honored only past two guards, in order:
   * 1. **Group-change guard** — `FeedDistributionCattleItem.feedGroupId` (snapshotted at confirm
   *    time, RAKHAL-430) must match the cow's *current* `feedGroupId` (`null === null` counts as a
   *    match — a groupless cow's own history is still hers). A cow moved to a different group falls
   *    through to that new group's default instead of inheriting the old group's feed.
   * 2. **Availability guard** — the resolved `FeedItem`/`FeedStock` must still exist, not be
   *    soft-deleted, and carry real stock (`> 0`).
   *
   * A `FeedStock` lot that fails the availability guard gets one more chance — **batch
   * fall-forward**: a sibling lot sharing the same `sourceConcentrationId` (same recipe, re-mixed)
   * that does have stock. Only then does resolution fall through to `FeedGroup`'s own
   * `defaultFeedSourceType`/`defaultFeedItemId`/`defaultFeedStockId` (RAKHAL-429) — returned as-is,
   * unguarded, since it is a farmer-configured intent rather than history; a shortfall there still
   * surfaces normally at confirm time via `resolveGroupPlan`'s own stock validation.
   */
  private async resolveDefaultSources(
    farmId: string,
    cattle: { id: string; feedGroupId: string | null }[],
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
        select: { id: true, currentStock: true, deletedAt: true },
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

    const groupIds = new Set<string>();
    for (const c of cattle) if (c.feedGroupId) groupIds.add(c.feedGroupId);
    const groups = groupIds.size
      ? await this.prisma.feedGroup.findMany({
          where: { id: { in: [...groupIds] }, farmId },
          select: {
            id: true,
            defaultFeedSourceType: true,
            defaultFeedItemId: true,
            defaultFeedStockId: true,
          },
        })
      : [];
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    const groupDefault = (
      feedGroupId: string | null,
    ): ResolvedSource | null => {
      const group = feedGroupId ? groupMap.get(feedGroupId) : undefined;
      if (!group?.defaultFeedSourceType) return null;
      return {
        sourceType: group.defaultFeedSourceType,
        feedItemId:
          group.defaultFeedSourceType === 'FEED_ITEM'
            ? (group.defaultFeedItemId ?? null)
            : null,
        feedStockId:
          group.defaultFeedSourceType === 'FEED_STOCK'
            ? (group.defaultFeedStockId ?? null)
            : null,
      };
    };

    const result = new Map<string, ResolvedSource | null>();
    for (const c of cattle) {
      const lastUsed = lastUsedByCattle.get(c.id);
      const groupChangeOk =
        lastUsed !== undefined && lastUsed.feedGroupId === c.feedGroupId;

      if (groupChangeOk && lastUsed.sourceType === 'FEED_ITEM') {
        const item = lastUsed.feedItemId
          ? itemMap.get(lastUsed.feedItemId)
          : undefined;
        if (item && !item.deletedAt && item.currentStock > 0) {
          result.set(c.id, {
            sourceType: 'FEED_ITEM',
            feedItemId: lastUsed.feedItemId,
            feedStockId: null,
          });
          continue;
        }
      } else if (groupChangeOk && lastUsed.sourceType === 'FEED_STOCK') {
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

      result.set(c.id, groupDefault(c.feedGroupId));
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
        feedGroupId: string | null;
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
        feedGroupId: true,
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
        feedGroupId: string | null;
      }
    >();
    for (const row of rows) {
      if (!map.has(row.cattleId) && row.sourceType) {
        map.set(row.cattleId, {
          sourceType: row.sourceType,
          feedItemId: row.feedItemId,
          feedStockId: row.feedStockId,
          feedGroupId: row.feedGroupId,
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
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      source_type: row.sourceType,
      feed_item_id: row.feedItemId,
      feed_stock_id: row.feedStockId,
      offered_kg: row.offeredKg,
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
