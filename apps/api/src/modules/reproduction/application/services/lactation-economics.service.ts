import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  allocateGroupFeedCost,
  computeDiscardedWithheldValue,
  computeLactationMargin,
  computeMilkRevenue,
  LactationFinancialTotals,
} from '../../domain/lactation-economics';
import { daysBetween } from '../../domain/lactation-yield';
import { LactationStatsService } from './lactation-stats.service';
import { computeCattleFinance } from '../../../cattle/application/services/cattle-finance-aggregation';

interface LactationEconomicsAccess {
  id: string;
  cattleId: string;
  cattleTagNumber: string;
  feedGroupId: string | null;
  startDate: Date;
  endDate: Date | null;
}

/**
 * Lactation economics (RAKHAL-289): milk revenue minus allocated feed,
 * medicine/treatment, breeding, and discarded/withheld-milk cost, alongside
 * (never blended with) the biological view already served by
 * `LactationStatsService.getStats()`.
 *
 * Entirely **read-only cross-module** — this service holds no Finance/Feed/
 * Health business logic of its own and never writes to those modules'
 * tables. Medicine/breeding cost figures are read via the shared
 * `computeCattleFinance()` aggregation (RAKHAL-352,
 * `src/modules/cattle/application/services/cattle-finance-aggregation.ts`) —
 * the exact same function `CattleDetailService.cattleFinance()` (`GET
 * /cattle/:id/finance`) uses, so the two surfaces can never disagree.
 */
@Injectable()
export class LactationEconomicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly lactationStatsService: LactationStatsService,
  ) {
    this.logger.setContext(LactationEconomicsService.name);
  }

  async getEconomics(farmId: string, lactationId: string) {
    const lactation = await this.getLactationOrThrow(farmId, lactationId);
    const rangeEnd = lactation.endDate ?? new Date();

    // RAKHAL-289 AC: reuse `getStats()`'s disposition-split totals (saleable/
    // withheld/discarded litres) rather than re-querying `MilkLogEntry` — the
    // biological view returned below comes straight from this same call, so
    // the two surfaces can never disagree about yield/DIM/peak.
    const stats = await this.lactationStatsService.getStats(
      farmId,
      lactationId,
    );

    const effectiveMilkRatePerLitre = await this.resolveEffectiveMilkRate(
      farmId,
      rangeEnd,
    );
    const feedCost = await this.computeAllocatedFeedCost(
      farmId,
      lactation.cattleId,
      lactation.feedGroupId,
      lactation.startDate,
      rangeEnd,
    );
    // RAKHAL-352: single shared aggregation (`cattle-finance-aggregation.ts`,
    // also used by `CattleDetailService.cattleFinance()` — `GET
    // /cattle/:id/finance`) so this figure and that route can never disagree
    // again. `end` is exclusive (`lt`), unlike the deleted
    // `sumExpenseBySubType()`'s inclusive `lte rangeEnd` — a negligible
    // boundary normalization (a txn dated at exact UTC midnight of
    // `rangeEnd` would previously count here and not there) traded for one
    // real source of truth.
    const cattleFinance = await computeCattleFinance(
      this.prisma,
      farmId,
      lactation.cattleId,
      lactation.startDate,
      rangeEnd,
    );
    const medicineCost = cattleFinance.expense.health;
    const breedingCost = cattleFinance.expense.breeding;

    const milkRevenue = computeMilkRevenue(
      stats.lactationToDate.saleable,
      effectiveMilkRatePerLitre,
    );
    const discardedWithheldValue = computeDiscardedWithheldValue(
      stats.lactationToDate.withheld,
      stats.lactationToDate.discarded,
      effectiveMilkRatePerLitre,
    );
    const financialTotals: LactationFinancialTotals = computeLactationMargin({
      milkRevenue,
      feedCost,
      medicineCost,
      breedingCost,
      discardedWithheldValue,
    });

    return {
      lactationId: lactation.id,
      cattleId: lactation.cattleId,
      tagNumber: lactation.cattleTagNumber,
      startDate: lactation.startDate,
      endDate: lactation.endDate,
      // Biological view (yield/DIM/peak) — never conflated with the
      // financial view below, per the ticket's own explicit AC. Sourced
      // entirely from the same `getStats()` call the financial view's
      // saleable/withheld/discarded litres already came from.
      biological: {
        dim: daysBetween(lactation.startDate, rangeEnd),
        today: stats.today,
        sevenDayAvgYield: stats.sevenDayAvgYield,
        thirtyDayAvgYield: stats.thirtyDayAvgYield,
        lactationToDate: stats.lactationToDate,
        peak: stats.peak,
        persistency: stats.persistency,
      },
      financial: {
        ...financialTotals,
        effectiveMilkRatePerLitre,
        saleableLitres: stats.lactationToDate.saleable,
        withheldLitres: stats.lactationToDate.withheld,
        discardedLitres: stats.lactationToDate.discarded,
      },
      assumptions: [
        "Milk revenue uses one effective rate per litre for the whole farm (the most recent dispatch price, or the average of active buyers' base price when no dispatch exists yet) — milk sales are not tracked per cow in this system.",
        "Group-fed feed cost is pro-rated evenly across the feed group's current headcount, not the headcount at the time each feed distribution happened (no historical headcount tracking exists).",
      ],
    };
  }

  /**
   * Prefers the most recent `MilkDispatch.basePricePerLitre` on/before the
   * lactation's range end (a real realized-price snapshot) over
   * `MilkBuyer.basePricePerLitre` (an agreed rate that may drift from what
   * was actually paid). Falls back to the average of active buyers' base
   * price when no dispatch has happened yet, and to 0 (flagged in
   * `assumptions`) when the farm has no buyer at all.
   */
  private async resolveEffectiveMilkRate(
    farmId: string,
    onOrBefore: Date,
  ): Promise<number> {
    const latestDispatch = await this.prisma.milkDispatch.findFirst({
      where: { farmId, dispatchedAt: { lte: onOrBefore } },
      orderBy: { dispatchedAt: 'desc' },
      select: { basePricePerLitre: true },
    });
    if (latestDispatch) return latestDispatch.basePricePerLitre;

    const activeBuyers = await this.prisma.milkBuyer.findMany({
      where: { farmId, isActive: true },
      select: { basePricePerLitre: true },
    });
    if (activeBuyers.length === 0) return 0;

    const sum = activeBuyers.reduce((s, b) => s + b.basePricePerLitre, 0);
    return sum / activeBuyers.length;
  }

  /**
   * Sums this cow's own individual `FeedDistribution` rows (full cost) plus
   * her pro-rated share of any group-targeted rows for her feed group, over
   * the lactation's date range. A cow with neither an individual
   * distribution nor a feed-group assignment allocates to 0.
   */
  private async computeAllocatedFeedCost(
    farmId: string,
    cattleId: string,
    feedGroupId: string | null,
    startDate: Date,
    rangeEnd: Date,
  ): Promise<number> {
    const orFilters: Array<Record<string, unknown>> = [{ cattleId }];
    if (feedGroupId) orFilters.push({ feedGroupId });

    const distributions = await this.prisma.feedDistribution.findMany({
      where: {
        farmId,
        distributedAt: { gte: startDate, lte: rangeEnd },
        OR: orFilters,
      },
      select: { cattleId: true, feedGroupId: true, totalActualCost: true },
    });
    if (distributions.length === 0) return 0;

    let groupHeadcount: number | null = null;
    if (
      feedGroupId &&
      distributions.some((d) => d.feedGroupId === feedGroupId)
    ) {
      groupHeadcount = await this.prisma.cattle.count({
        where: { farmId, feedGroupId, herdStatus: 'ACTIVE', deletedAt: null },
      });
    }

    let total = 0;
    for (const d of distributions) {
      if (d.cattleId === cattleId) {
        total += d.totalActualCost;
      } else if (feedGroupId && d.feedGroupId === feedGroupId) {
        total += allocateGroupFeedCost(d.totalActualCost, groupHeadcount ?? 0);
      }
    }
    return Math.round(total * 100) / 100;
  }

  /** Resolve a `Lactation` scoped to the active farm via its owning `Cattle` (tenant isolation). */
  private async getLactationOrThrow(
    farmId: string,
    lactationId: string,
  ): Promise<LactationEconomicsAccess> {
    const lactation = await this.prisma.lactation.findFirst({
      where: { id: lactationId, cattle: { farmId } },
      select: {
        id: true,
        cattleId: true,
        startDate: true,
        endDate: true,
        cattle: { select: { tagNumber: true, feedGroupId: true } },
      },
    });
    if (!lactation) {
      throw new NotFoundException('Lactation not found');
    }
    return {
      id: lactation.id,
      cattleId: lactation.cattleId,
      cattleTagNumber: lactation.cattle.tagNumber,
      feedGroupId: lactation.cattle.feedGroupId,
      startDate: lactation.startDate,
      endDate: lactation.endDate,
    };
  }
}
