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
import {
  FeedEfficiencyQueryDto,
  ListDistributionQueryDto,
} from '../../presentation/dto/list-distribution-query.dto';
import { FeedStockService } from './feed-stock.service';

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

    const decrements = await this.planForageDecrements(farmId, lines);
    const itemsForCreate = lines.map((line) => ({
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      plannedKg: line.plannedKg,
      actualKg: line.actualKg,
      refusalKg: line.refusalKg,
      pricePerKg: line.pricePerKg,
      lineCost: line.lineCost,
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

  /** Planned-vs-actual + feed cost per litre for a group OR a single cow, over a month (§12.5,
   * extended Phase 12.4 2026-07-18 to also cover an INDIVIDUAL-targeted TMR — a farmer feeding one
   * cow her own ration wants the same cost-per-litre visibility a group gets). Exactly one of
   * `feedGroupId`/`cattleId` is expected (`FeedEfficiencyQueryDto`'s `@ValidateIf` cross-check). */
  async efficiency(farmId: string, query: FeedEfficiencyQueryDto) {
    const { start, end, label } = this.monthRange(query.month);

    if (query.cattleId) {
      const cattle = await this.prisma.cattle.findFirst({
        where: { id: query.cattleId, farmId },
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
      where: { id: query.feedGroupId, farmId },
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
        where: { farmId, feedGroupId: group.id },
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
        unit: true,
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
      const isKg = f.unit.trim().toLowerCase() === 'kg';
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
      return { forageId, newStock: round2(Math.max(0, f.currentStock - used)) };
    });
  }

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
    concentrationId: string;
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
