import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { resolveEffective } from '../../domain/ingredient-resolver';
import { LogDistributionDto } from '../../presentation/dto/log-distribution.dto';
import { PatchRefusalDto } from '../../presentation/dto/patch-refusal.dto';
import {
  FeedEfficiencyQueryDto,
  ListDistributionQueryDto,
} from '../../presentation/dto/list-distribution-query.dto';
import { FeedStockService } from './feed-stock.service';
import { FeedRationResolverService } from './feed-ration-resolver.service';
import { FeedRequirementsService } from './feed-requirements.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Feed Distribution Tracking (PRD §12.5, V1.5). Logs the actual quantities of a
 * concentration formula distributed to its group (or, since Phase 12.4, a single cow) on a day —
 * pre-filled from the formula's planned amounts, with optional refusal/leftover — and computes cost
 * from actual quantities at the farm's effective ingredient prices. Three independent stock-decrement
 * paths, all best-effort/optional: (1) decrementing a matching `FeedItem` by its real `ingredientId`
 * FK, converting through `kgPerUnit` for a non-kg unit (§15.3); (2) a per-line `stockId` override for
 * a real `FeedStock` lot (rarely used by the frontend today, kept for a future raw-ingredient-level
 * stock flow); (3) the concentration's own finalized batch lot
 * (`FeedStock.sourceConcentrationId`), auto-decremented by the distribution's total actual kg — this
 * is the path "Feed Today" (Phase 12.4) actually relies on, since a TMR's finalize produces one
 * aggregate-batch lot, not a per-ingredient breakdown. Reads
 * `FeedConcentration`/`FeedItem`/`Cattle`/`MilkLogEntry` directly via Prisma (the feed-module pattern —
 * no cross-module service coupling).
 */
@Injectable()
export class FeedDistributionService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly feedStock: FeedStockService,
    private readonly rationResolver: FeedRationResolverService,
    private readonly feedRequirements: FeedRequirementsService,
  ) {
    this.log = logger.setContext(FeedDistributionService.name);
  }

  async create(farmId: string, userId: string, dto: LogDistributionDto) {
    const concentration = await this.prisma.feedConcentration.findFirst({
      where: { id: dto.concentrationId, farmId, isActive: true },
      include: { items: true },
    });
    if (!concentration) {
      throw new NotFoundException('Concentration template not found');
    }
    if (concentration.items.length === 0) {
      throw new BadRequestException(
        'Concentration has no ingredient lines to distribute',
      );
    }

    const ingredientIds = concentration.items.map((i) => i.ingredientId);
    const validIds = new Set(ingredientIds);
    const overrides = new Map(
      (dto.items ?? []).map((i) => [i.ingredientId, i]),
    );
    for (const id of overrides.keys()) {
      if (!validIds.has(id)) {
        throw new BadRequestException(
          `Ingredient ${id} is not part of this concentration`,
        );
      }
    }

    const [effById, nameById] = await Promise.all([
      this.effectiveMap(farmId, ingredientIds),
      this.ingredientNames(ingredientIds),
    ]);

    const lines = concentration.items.map((item) => {
      const eff = effById.get(item.ingredientId);
      const price = eff?.pricePerKg ?? 0;
      const override = overrides.get(item.ingredientId);
      const plannedKg = item.amountKg;
      const actualKg = override?.actualKg ?? plannedKg;
      const refusalKg = override?.refusalKg ?? 0;
      return {
        ingredientId: item.ingredientId,
        ingredientName: nameById.get(item.ingredientId) ?? item.ingredientId,
        plannedKg: round2(plannedKg),
        actualKg: round2(actualKg),
        refusalKg: round2(refusalKg),
        pricePerKg: round2(price),
        lineCost: round2(actualKg * price),
        stockId: override?.stockId,
        // RAKHAL-327/328 follow-up: freeze the SAME live `effectiveMap()` lookup already made to
        // price this line, so a later edit to the ingredient's nutrients in the catalogue can't
        // silently rewrite this historical distribution's nutrient totals.
        ...(eff
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
          : {}),
      };
    });

    // Real FK-backed decrement (user request 2026-07-17) — a line can name a specific `FeedStock`
    // lot instead of relying on the FeedItem ingredientId-match below. Validated up-front so a
    // shortfall is caught before the distribution row is created.
    const stockRequests = lines
      .filter((l): l is typeof l & { stockId: string } => l.stockId != null)
      .map((l) => ({ stockId: l.stockId, quantity: l.actualKg }));
    if (stockRequests.length > 0) {
      await this.feedStock.assertSufficientStock(farmId, stockRequests);
    }

    const totals = lines.reduce(
      (acc, l) => {
        acc.plannedKg += l.plannedKg;
        acc.actualKg += l.actualKg;
        acc.refusalKg += l.refusalKg;
        acc.plannedCost += l.plannedKg * l.pricePerKg;
        acc.actualCost += l.lineCost;
        return acc;
      },
      {
        plannedKg: 0,
        actualKg: 0,
        refusalKg: 0,
        plannedCost: 0,
        actualCost: 0,
      },
    );

    // The TMR/Concentrate Mixer's own finalized batch (Phase 12.4, 2026-07-18) — distinct from the
    // per-line `stockId` overrides above: `finalize()` produces ONE `FeedStock` lot representing
    // this whole concentration's total batch kg, not a per-ingredient breakdown, so decrementing it
    // can't go through the per-item path. Auto-resolve the oldest lot with stock remaining (FIFO,
    // MVP simplification — doesn't split across multiple lots if one alone can't cover it) and
    // decrement it by the total actual kg fed. This is what makes "Finalize, then feed cows from
    // that batch" actually move `current_stock_kg` without the caller ever supplying a stock-lot id.
    // Skipped entirely when the caller already supplied an explicit per-line `stockId` — that means
    // they're managing stock decrements themselves for this call, and (as `feed-distribution-stock.
    // e2e-spec.ts` covers) a per-line `stockId` can legitimately target this same concentration's own
    // lot, which would otherwise get decremented twice for one distribution.
    const ownStock =
      stockRequests.length === 0
        ? await this.prisma.feedStock.findFirst({
            where: {
              farmId,
              sourceConcentrationId: concentration.id,
              currentStockKg: { gt: 0 },
              isActive: true,
            },
            orderBy: { producedAt: 'asc' },
          })
        : null;
    if (ownStock && totals.actualKg > 0) {
      await this.feedStock.assertSufficientStock(farmId, [
        { stockId: ownStock.id, quantity: totals.actualKg },
      ]);
    }

    const distributedAt = dto.distributedAt
      ? this.dayStart(dto.distributedAt)
      : this.dayStart();

    // Stamp which checkpoint was live when this was logged (2026-08-13, ration versioning) —
    // `concentration.versionNumber` is the *next* counter (see `FeedConcentration.versionNumber`'s
    // doc comment), so the current live version's row is one behind it. Null if no checkpoint has
    // ever been saved yet (matches current live state, same as before versioning existed).
    const currentVersion =
      concentration.versionNumber > 1
        ? await this.prisma.feedConcentrationVersion.findUnique({
            where: {
              concentrationId_versionNumber: {
                concentrationId: concentration.id,
                versionNumber: concentration.versionNumber - 1,
              },
            },
            select: { id: true },
          })
        : null;

    const decrements = await this.planForageDecrements(farmId, lines);
    const itemsForCreate = lines.map((line) => ({
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      plannedKg: line.plannedKg,
      actualKg: line.actualKg,
      refusalKg: line.refusalKg,
      pricePerKg: line.pricePerKg,
      lineCost: line.lineCost,
      dmPct: line.dmPct ?? null,
      cpPct: line.cpPct ?? null,
      meMjPerKgDm: line.meMjPerKgDm ?? null,
      fatPct: line.fatPct ?? null,
      ndfPct: line.ndfPct ?? null,
      rdpPct: line.rdpPct ?? null,
      rupPct: line.rupPct ?? null,
      starchPct: line.starchPct ?? null,
      adfPct: line.adfPct ?? null,
      calciumPct: line.calciumPct ?? null,
      phosphorusPct: line.phosphorusPct ?? null,
      tdnPct: line.tdnPct ?? null,
    }));

    // Target is derived from the source TMR, never supplied by the caller directly (Phase 12.4,
    // 2026-07-18) — a concentration is already either GROUP- or INDIVIDUAL-targeted from creation,
    // so logging a distribution for it naturally records against that same target.
    const targetFields =
      concentration.targetType === 'INDIVIDUAL'
        ? { feedGroupId: null, cattleId: concentration.cattleId }
        : { feedGroupId: concentration.feedGroupId, cattleId: null };

    const created = await this.prisma.$transaction(async (tx) => {
      const dist = await tx.feedDistribution.create({
        data: {
          farmId,
          concentrationId: concentration.id,
          concentrationVersionId: currentVersion?.id,
          ...targetFields,
          distributedAt,
          totalPlannedKg: round2(totals.plannedKg),
          totalActualKg: round2(totals.actualKg),
          totalRefusalKg: round2(totals.refusalKg),
          totalPlannedCost: round2(totals.plannedCost),
          totalActualCost: round2(totals.actualCost),
          notes: dto.notes,
          createdBy: userId,
          items: { create: itemsForCreate },
        },
        include: { items: true },
      });
      for (const d of decrements) {
        await tx.feedItem.update({
          where: { id: d.forageId },
          data: { currentStock: d.newStock },
        });
      }
      return dist;
    });

    for (const req of stockRequests) {
      await this.feedStock.decrementForDistribution(farmId, userId, {
        stockId: req.stockId,
        quantity: req.quantity,
        distributionId: created.id,
      });
    }
    if (ownStock && totals.actualKg > 0) {
      await this.feedStock.decrementForDistribution(farmId, userId, {
        stockId: ownStock.id,
        quantity: totals.actualKg,
        distributionId: created.id,
      });
    }

    this.log.info('Feed distribution logged', {
      farmId,
      id: created.id,
      forageDecrements: decrements.length,
      stockDecrements: stockRequests.length + (ownStock ? 1 : 0),
    });
    return this.mapDistribution(created, decrements);
  }

  /**
   * Direct-by-id `FeedItem` usage computation — validates sufficient stock and converts through
   * `kgPerUnit` for a non-kg unit, same conversion `planForageDecrements` uses for the
   * concentration-based path. Read-only (doesn't persist); the caller applies `newStock` inside its
   * own transaction. Extracted from the old `quickFeed()` (removed 2026-08-15, replaced by the
   * Feeding Grid) so `FeedFeedingGridService#confirm`'s `FEED_ITEM` source path can reuse the same
   * validated conversion math without re-deriving it.
   */
  async computeFeedItemUsage(
    farmId: string,
    feedItemId: string,
    quantityKg: number,
  ) {
    const feedItem = await this.prisma.feedItem.findFirst({
      where: { id: feedItemId, farmId, isActive: true },
      include: { unit: true },
    });
    if (!feedItem) throw new NotFoundException('Feed item not found');

    const isKg = feedItem.unit.symbol === 'kg';
    const pricePerKg = isKg
      ? feedItem.costPerUnit
      : feedItem.kgPerUnit && feedItem.kgPerUnit > 0
        ? feedItem.costPerUnit / feedItem.kgPerUnit
        : 0;

    const usedInUnit = isKg
      ? quantityKg
      : feedItem.kgPerUnit && feedItem.kgPerUnit > 0
        ? quantityKg / feedItem.kgPerUnit
        : 0;
    if (usedInUnit > feedItem.currentStock) {
      throw new BadRequestException(
        `Not enough ${feedItem.name} in stock (${feedItem.currentStock} ${feedItem.unit.symbol} available, ${round2(usedInUnit)} needed)`,
      );
    }
    const newStock = round2(feedItem.currentStock - usedInUnit);

    return {
      feedItem,
      ingredientId: feedItem.ingredientId ?? feedItem.id,
      ingredientName: feedItem.name,
      pricePerKg: round2(pricePerKg),
      newStock,
    };
  }

  async list(farmId: string, query: ListDistributionQueryDto) {
    const dateFilter = this.dateRange(query.fromDate, query.toDate);
    const rows = await this.prisma.feedDistribution.findMany({
      where: {
        farmId,
        ...(query.feedGroupId ? { feedGroupId: query.feedGroupId } : {}),
        ...(query.cattleId ? { cattleId: query.cattleId } : {}),
        ...(query.concentrationId
          ? { concentrationId: query.concentrationId }
          : {}),
        ...(dateFilter ? { distributedAt: dateFilter } : {}),
      },
      orderBy: [{ distributedAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((r) => this.mapSummary(r)),
      meta: page.meta,
    };
  }

  async get(farmId: string, id: string) {
    const row = await this.prisma.feedDistribution.findFirst({
      where: { id, farmId },
      include: { items: true },
    });
    if (!row) throw new NotFoundException('Feed distribution not found');
    return this.mapDistribution(row);
  }

  /** Next-day leftover weigh-in (2026-08-13, user request) — updates each named line's
   * `refusalKg` and recomputes `totalRefusalKg`; lines not mentioned in `dto.items` keep
   * their existing value. Refusal is informational only (see class doc comment) — it never
   * touches `lineCost`/`totalActualCost`, only `refusalKg`/`totalRefusalKg`. */
  async patchRefusal(farmId: string, id: string, dto: PatchRefusalDto) {
    const row = await this.prisma.feedDistribution.findFirst({
      where: { id, farmId },
      include: { items: true },
    });
    if (!row) throw new NotFoundException('Feed distribution not found');

    const byIngredient = new Map(dto.items.map((i) => [i.ingredientId, i]));
    for (const id of byIngredient.keys()) {
      if (!row.items.some((it) => it.ingredientId === id)) {
        throw new BadRequestException(
          `Ingredient ${id} is not part of this distribution`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of row.items) {
        const patch = byIngredient.get(item.ingredientId);
        if (!patch) continue;
        await tx.feedDistributionItem.update({
          where: { id: item.id },
          data: { refusalKg: round2(patch.refusalKg) },
        });
      }
      const items = await tx.feedDistributionItem.findMany({
        where: { distributionId: id },
      });
      const totalRefusalKg = round2(
        items.reduce((sum, i) => sum + i.refusalKg, 0),
      );
      return tx.feedDistribution.update({
        where: { id },
        data: { totalRefusalKg },
        include: { items: true },
      });
    });

    this.log.info('Feed distribution refusal recorded', {
      farmId,
      id,
      totalRefusalKg: updated.totalRefusalKg,
    });
    return this.mapDistribution(updated);
  }

  /** Refusal-rate trend for a feed group, most-recent-first (feeds the Feeding dashboard and
   * the Cattle-detail group view). Compares each day's rate against the group's configured
   * `refusalTargetPct` (2026-08-13) — doc explicitly warns against one universal target, so
   * this is per-group, not farm-wide. */
  async getRefusalTrend(farmId: string, feedGroupId: string, days = 30) {
    const group = await this.prisma.feedGroup.findFirst({
      where: { id: feedGroupId, farmId, isActive: true },
      select: { id: true, name: true, refusalTargetPct: true },
    });
    if (!group) throw new NotFoundException('Feed group not found');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.feedDistribution.findMany({
      where: { farmId, feedGroupId, distributedAt: { gte: since } },
      orderBy: { distributedAt: 'desc' },
      select: {
        distributedAt: true,
        totalPlannedKg: true,
        totalActualKg: true,
        totalRefusalKg: true,
      },
    });

    return {
      feed_group_id: group.id,
      feed_group_name: group.name,
      refusal_target_pct: group.refusalTargetPct,
      days: rows.map((r) => {
        const refusalPct =
          r.totalActualKg > 0
            ? round2((r.totalRefusalKg / r.totalActualKg) * 100)
            : null;
        return {
          date: r.distributedAt,
          planned_kg: r.totalPlannedKg,
          actual_kg: r.totalActualKg,
          refusal_kg: r.totalRefusalKg,
          refusal_pct: refusalPct,
          over_target:
            group.refusalTargetPct != null && refusalPct != null
              ? refusalPct > group.refusalTargetPct
              : null,
        };
      }),
    };
  }

  /** Planned-vs-actual + feed cost per litre for a group OR a single cow, over a month (§12.5,
   * extended Phase 12.4 2026-07-18 to also cover an INDIVIDUAL-targeted TMR — a farmer feeding one
   * cow her own ration wants the same cost-per-litre visibility a group gets). Exactly one of
   * `feedGroupId`/`cattleId` is expected (`FeedEfficiencyQueryDto`'s `@ValidateIf` cross-check). */
  async efficiency(farmId: string, query: FeedEfficiencyQueryDto) {
    const { start, end, label } = this.monthRange(query.month);

    if (query.cattleId) {
      const cattle = await this.prisma.cattle.findFirst({
        where: { id: query.cattleId, farmId, isActive: true },
        select: { id: true, tagNumber: true, name: true },
      });
      if (!cattle) throw new NotFoundException('Cattle not found');

      const [distributions, litresAgg] = await Promise.all([
        this.prisma.feedDistribution.findMany({
          where: {
            farmId,
            cattleId: cattle.id,
            distributedAt: { gte: start, lt: end },
          },
          select: this.EFFICIENCY_DISTRIBUTION_SELECT,
        }),
        this.prisma.milkLogEntry.aggregate({
          where: {
            farmId,
            cattleId: cattle.id,
            logDate: { gte: start, lt: end },
          },
          _sum: { yieldL: true },
        }),
      ]);

      return {
        feed_group_id: null,
        feed_group_name: null,
        cattle_id: cattle.id,
        cattle_name: cattle.name ?? cattle.tagNumber,
        period: label,
        ...this.summarizeEfficiency(distributions, litresAgg._sum.yieldL ?? 0),
      };
    }

    const group = await this.prisma.feedGroup.findFirst({
      where: { id: query.feedGroupId, farmId, isActive: true },
      select: { id: true, name: true },
    });
    if (!group) throw new NotFoundException('Feed group not found');

    const [distributions, groupCattle] = await Promise.all([
      this.prisma.feedDistribution.findMany({
        where: {
          farmId,
          feedGroupId: group.id,
          distributedAt: { gte: start, lt: end },
        },
        select: this.EFFICIENCY_DISTRIBUTION_SELECT,
      }),
      this.prisma.cattle.findMany({
        where: { farmId, feedGroupId: group.id, isActive: true },
        select: { id: true },
      }),
    ]);

    const litresAgg = await this.prisma.milkLogEntry.aggregate({
      where: {
        farmId,
        cattleId: { in: groupCattle.map((c) => c.id) },
        logDate: { gte: start, lt: end },
      },
      _sum: { yieldL: true },
    });

    return {
      feed_group_id: group.id,
      feed_group_name: group.name,
      cattle_id: null,
      cattle_name: null,
      period: label,
      group_cattle: groupCattle.length,
      ...this.summarizeEfficiency(distributions, litresAgg._sum.yieldL ?? 0),
    };
  }

  /**
   * Actual vs expected dry-matter intake for a cow (2026-08-13, user request). Expected
   * comes from `FeedRequirementsService`'s NRC-2001 calc for this cow; actual sums that
   * day's distribution(s) that reach her, converted to DM via each line's FROZEN `dmPct`
   * snapshot (RAKHAL-327/328 follow-up, 2026-08-15 — no live catalogue lookup for historical
   * rows anymore, see the inline comment below). A GROUP- or HERD-targeted
   * ration's distribution is shared across many cows, so actual DMI is pro-rated by
   * headcount at that level — the same "divide the shared total by who's eating from it"
   * idea `lactation-economics.service.ts`'s `computeAllocatedFeedCost` uses for cost, kept
   * as its own query here rather than a cross-module call (feed module already reads
   * `Cattle` directly elsewhere, e.g. `validateTargets` — same established pattern).
   */
  async getDmiComparison(farmId: string, cattleId: string, date?: string) {
    const [resolved, reqResult] = await Promise.all([
      this.rationResolver.resolveActiveRation(farmId, cattleId),
      this.feedRequirements.calc(farmId, { cattleId }),
    ]);
    // `calc({ cattleId })` always takes the single-cow branch at runtime, but its return type
    // is a union across all three call shapes (cattle/group/manual) — narrow explicitly.
    const expectedDmiKg =
      'requirements' in reqResult ? reqResult.requirements.dm_kg : 0;

    if (!resolved) {
      return {
        expected_dmi_kg: expectedDmiKg,
        actual_dmi_kg: null,
        delta_pct: null,
        match_level: null,
      };
    }

    const day = this.dayStart(date);
    const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const dateFilter = { gte: day, lt: nextDay };

    let distributions: {
      items: { ingredientId: string; actualKg: number; dmPct: number | null }[];
    }[];
    let headcount = 1;

    if (resolved.matchLevel === 'INDIVIDUAL') {
      distributions = await this.prisma.feedDistribution.findMany({
        where: { farmId, cattleId, distributedAt: dateFilter },
        include: { items: true },
      });
    } else if (resolved.matchLevel === 'GROUP') {
      const cattle = await this.prisma.cattle.findFirst({
        where: { id: cattleId, farmId },
        select: { feedGroupId: true },
      });
      const feedGroupId = cattle?.feedGroupId;
      [distributions, headcount] = await Promise.all([
        this.prisma.feedDistribution.findMany({
          where: { farmId, feedGroupId, distributedAt: dateFilter },
          include: { items: true },
        }),
        this.prisma.cattle.count({
          where: { farmId, feedGroupId, isActive: true },
        }),
      ]);
      headcount = Math.max(1, headcount);
    } else {
      [distributions, headcount] = await Promise.all([
        this.prisma.feedDistribution.findMany({
          where: {
            farmId,
            feedGroupId: null,
            cattleId: null,
            distributedAt: dateFilter,
            concentrationId: resolved.concentration.id,
          },
          include: { items: true },
        }),
        this.prisma.cattle.count({ where: { farmId, isActive: true } }),
      ]);
      headcount = Math.max(1, headcount);
    }

    const allItems = distributions.flatMap((d) => d.items);
    if (allItems.length === 0) {
      return {
        expected_dmi_kg: expectedDmiKg,
        actual_dmi_kg: null,
        delta_pct: null,
        match_level: resolved.matchLevel,
      };
    }

    // RAKHAL-327/328 follow-up: read each line's FROZEN `dmPct` snapshot (taken at logging time,
    // `create()`/`FeedFeedingGridService#confirm`) instead of re-resolving the live catalogue via
    // `effectiveMap()` — a farmer editing an ingredient's nutrients later can no longer silently
    // rewrite a past DMI comparison. Lines predating this snapshot (`dmPct === null`) are excluded
    // rather than re-derived, matching this column's "no backfill, don't fabricate" convention.
    const dmKgTotal = allItems.reduce((sum, i) => {
      if (i.dmPct == null) return sum;
      return sum + i.actualKg * (i.dmPct / 100);
    }, 0);
    const actualDmiKg = round2(dmKgTotal / headcount);
    const deltaPct =
      expectedDmiKg > 0
        ? round2(((actualDmiKg - expectedDmiKg) / expectedDmiKg) * 100)
        : null;

    return {
      expected_dmi_kg: expectedDmiKg,
      actual_dmi_kg: actualDmiKg,
      delta_pct: deltaPct,
      match_level: resolved.matchLevel,
    };
  }

  /**
   * Farm-wide feed cost summary (2026-08-13, user request — "Feed cost/cow, cost/litre...
   * on main Dashboard or Reports"). Per-cow allocation already exists for a single lactation
   * via `lactation-economics.service.ts`'s `computeAllocatedFeedCost` (kept where it is —
   * it's tightly coupled to that service's lactation date-range plumbing); this is the
   * farm-wide counterpart Dashboard/Reports actually need: total feed spend over the window
   * divided by active headcount (cost/cow/day) and by total milk litres produced in the same
   * window (cost/litre), plus a day-by-day trend for a sparkline.
   */
  async getFarmFeedCostSummary(farmId: string, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [distributions, milkAgg, headcount] = await Promise.all([
      this.prisma.feedDistribution.findMany({
        where: { farmId, distributedAt: { gte: since } },
        select: { distributedAt: true, totalActualCost: true },
      }),
      this.prisma.milkLogEntry.aggregate({
        where: { farmId, logDate: { gte: since } },
        _sum: { yieldL: true },
      }),
      this.prisma.cattle.count({ where: { farmId, isActive: true } }),
    ]);

    const totalCost = round2(
      distributions.reduce((sum, d) => sum + d.totalActualCost, 0),
    );
    const totalLitres = milkAgg._sum.yieldL ?? 0;

    const byDay = new Map<string, number>();
    for (const d of distributions) {
      const key = d.distributedAt.toISOString().slice(0, 10);
      byDay.set(key, round2((byDay.get(key) ?? 0) + d.totalActualCost));
    }
    const trend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({ date, total_cost: cost }));

    return {
      days,
      total_cost: totalCost,
      cost_per_cow_per_day:
        headcount > 0 ? round2(totalCost / days / headcount) : null,
      cost_per_litre: totalLitres > 0 ? round2(totalCost / totalLitres) : null,
      headcount,
      total_litres: round2(totalLitres),
      trend,
    };
  }

  // ---- internals ----------------------------------------------------------

  /** Shared `Prisma.FeedDistribution` field selection for `efficiency()`'s two branches (group /
   * cattle) — kept as one constant so both queries stay provably identical in shape. */
  private readonly EFFICIENCY_DISTRIBUTION_SELECT = {
    totalPlannedKg: true,
    totalActualKg: true,
    totalRefusalKg: true,
    totalPlannedCost: true,
    totalActualCost: true,
  } as const;

  /** Shared adherence/refusal/cost-per-litre reduction — `efficiency()`'s group and cattle branches
   * both funnel through this so the two paths can never compute the math differently. */
  private summarizeEfficiency(
    distributions: {
      totalPlannedKg: number;
      totalActualKg: number;
      totalRefusalKg: number;
      totalPlannedCost: number;
      totalActualCost: number;
    }[],
    litres: number,
  ) {
    const t = distributions.reduce(
      (acc, d) => {
        acc.plannedKg += d.totalPlannedKg;
        acc.actualKg += d.totalActualKg;
        acc.refusalKg += d.totalRefusalKg;
        acc.plannedCost += d.totalPlannedCost;
        acc.actualCost += d.totalActualCost;
        return acc;
      },
      {
        plannedKg: 0,
        actualKg: 0,
        refusalKg: 0,
        plannedCost: 0,
        actualCost: 0,
      },
    );
    const consumedKg = t.actualKg - t.refusalKg;
    return {
      distributions: distributions.length,
      planned_kg: round2(t.plannedKg),
      actual_kg: round2(t.actualKg),
      refusal_kg: round2(t.refusalKg),
      consumed_kg: round2(consumedKg),
      planned_cost: round2(t.plannedCost),
      actual_cost: round2(t.actualCost),
      adherence_pct:
        t.plannedKg > 0 ? round2((t.actualKg / t.plannedKg) * 100) : null,
      refusal_pct:
        t.actualKg > 0 ? round2((t.refusalKg / t.actualKg) * 100) : null,
      litres_produced: round2(litres),
      feed_cost_per_litre: litres > 0 ? round2(t.actualCost / litres) : null,
    };
  }

  /**
   * Feed item decrement (§15.3): match each line's ingredient by its real
   * `ingredientId` FK to an active `FeedItem` and subtract the actual kg
   * (floored at 0), converting through `kgPerUnit` for a non-kg-unit item
   * (bag/sack) instead of skipping it — previously this only matched by
   * lowercased ingredient name and only decremented kg-unit rows, so e.g. a
   * bag-unit "Wheat bran" purchase never moved on a feed log at all. Rows
   * with neither a kg unit nor a `kgPerUnit` conversion factor still can't be
   * converted and are skipped (kept, not floor-guessed).
   */
  private async planForageDecrements(
    farmId: string,
    lines: { ingredientId: string; actualKg: number }[],
  ): Promise<{ forageId: string; newStock: number }[]> {
    const ingredientIds = [...new Set(lines.map((l) => l.ingredientId))];
    const feedItems = await this.prisma.feedItem.findMany({
      where: { farmId, isActive: true, ingredientId: { in: ingredientIds } },
      select: {
        id: true,
        ingredientId: true,
        unit: { select: { symbol: true } },
        kgPerUnit: true,
        currentStock: true,
      },
    });
    const byIngredient = new Map(
      feedItems
        .filter((f) => f.ingredientId != null)
        .map((f) => [f.ingredientId as string, f]),
    );

    const usageByFeedItem = new Map<string, number>();
    for (const line of lines) {
      const f = byIngredient.get(line.ingredientId);
      if (!f || line.actualKg <= 0) continue;
      const isKg = f.unit.symbol === 'kg';
      // Convert the fed kg into "units" for a non-kg item (bag/sack), then back to
      // a unit-count decrement — kgPerUnit is required to do that conversion safely.
      const usedInUnit = isKg
        ? line.actualKg
        : f.kgPerUnit && f.kgPerUnit > 0
          ? line.actualKg / f.kgPerUnit
          : null;
      if (usedInUnit == null) continue;
      usageByFeedItem.set(f.id, (usageByFeedItem.get(f.id) ?? 0) + usedInUnit);
    }

    return [...usageByFeedItem.entries()].map(([forageId, used]) => {
      const f = feedItems.find((x) => x.id === forageId)!;
      if (used > f.currentStock) {
        throw new BadRequestException(
          `Not enough stock for this feeding — need ${round2(used)} ${f.unit.symbol}, only ${f.currentStock} ${f.unit.symbol} available. Check Inventory before feeding.`,
        );
      }
      return { forageId, newStock: round2(f.currentStock - used) };
    });
  }

  /** Public single-id wrapper around `effectiveMap()` (RAKHAL-327/328 follow-up) — lets
   * `FeedFeedingGridService#confirm`'s `FEED_ITEM` path freeze the same live nutrition lookup
   * this service uses internally, without duplicating the ingredient+override query here. */
  async getEffectiveNutrition(farmId: string, ingredientId: string) {
    const map = await this.effectiveMap(farmId, [ingredientId]);
    return map.get(ingredientId) ?? null;
  }

  // No `isActive` filter (RAKHAL-310): `ingredientIds` come from an existing
  // concentration's line items, which must keep pricing even if the
  // ingredient was archived after the distribution was logged.
  private async effectiveMap(farmId: string, ingredientIds: string[]) {
    const ids = [...new Set(ingredientIds)];
    const [ingredients, overrides] = await Promise.all([
      this.prisma.feedIngredient.findMany({ where: { id: { in: ids } } }),
      this.prisma.feedIngredientOverride.findMany({
        where: { farmId, ingredientId: { in: ids } },
      }),
    ]);
    const ovById = new Map(overrides.map((o) => [o.ingredientId, o]));
    return new Map(
      ingredients.map((ing) => [
        ing.id,
        resolveEffective(ing, ovById.get(ing.id) ?? null),
      ]),
    );
  }

  // No `isActive` filter (RAKHAL-310) — same historical-resolve rationale as
  // `effectiveMap()` above.
  private async ingredientNames(ids: string[]) {
    const rows = await this.prisma.feedIngredient.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, nameEn: true },
    });
    return new Map(rows.map((r) => [r.id, r.nameEn]));
  }

  private mapDistribution(
    row: Prisma.FeedDistributionGetPayload<{ include: { items: true } }>,
    decrements?: { forageId: string; newStock: number }[],
  ) {
    return {
      id: row.id,
      concentration_id: row.concentrationId,
      feed_group_id: row.feedGroupId,
      cattle_id: row.cattleId,
      distributed_at: row.distributedAt,
      total_planned_kg: row.totalPlannedKg,
      total_actual_kg: row.totalActualKg,
      total_refusal_kg: row.totalRefusalKg,
      total_planned_cost: row.totalPlannedCost,
      total_actual_cost: row.totalActualCost,
      notes: row.notes,
      forage_decrements: decrements?.length ?? null,
      items: row.items.map((i) => ({
        ingredient_id: i.ingredientId,
        name: i.ingredientName,
        planned_kg: i.plannedKg,
        actual_kg: i.actualKg,
        refusal_kg: i.refusalKg,
        price_per_kg: i.pricePerKg,
        line_cost: i.lineCost,
      })),
      created_at: row.createdAt,
    };
  }

  private mapSummary(row: {
    id: string;
    concentrationId: string | null;
    feedGroupId: string | null;
    cattleId: string | null;
    distributedAt: Date;
    totalActualKg: number;
    totalActualCost: number;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      concentration_id: row.concentrationId,
      feed_group_id: row.feedGroupId,
      cattle_id: row.cattleId,
      distributed_at: row.distributedAt,
      total_actual_kg: row.totalActualKg,
      total_actual_cost: row.totalActualCost,
      created_at: row.createdAt,
    };
  }

  private dayStart(dateStr?: string): Date {
    const d = dateStr ? new Date(dateStr) : new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private dateRange(fromDate?: string, toDate?: string) {
    if (!fromDate && !toDate) return null;
    const range: { gte?: Date; lt?: Date } = {};
    if (fromDate) range.gte = this.dayStart(fromDate);
    if (toDate) {
      const d = this.dayStart(toDate);
      range.lt = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    }
    return range;
  }

  private monthRange(month?: string): {
    start: Date;
    end: Date;
    label: string;
  } {
    const now = new Date();
    let year = now.getUTCFullYear();
    let m = now.getUTCMonth();
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, mm] = month.split('-').map(Number);
      year = y;
      m = mm - 1;
    }
    return {
      start: new Date(Date.UTC(year, m, 1)),
      end: new Date(Date.UTC(year, m + 1, 1)),
      label: `${year}-${String(m + 1).padStart(2, '0')}`,
    };
  }
}
