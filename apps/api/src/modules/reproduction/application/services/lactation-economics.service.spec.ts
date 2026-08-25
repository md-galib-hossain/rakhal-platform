import { NotFoundException } from '@nestjs/common';
import { ExpenseCategory } from '@prisma/client';
import { LactationEconomicsService } from './lactation-economics.service';

/**
 * RAKHAL-289 — read-only lactation economics. Mocked Prisma + Logger +
 * `LactationStatsService` (direct-instantiation pattern, matches
 * `lactation-stats.service.spec.ts`'s precedent) since this service is a
 * thin, side-effect-free aggregator over cross-module read queries.
 */
describe('LactationEconomicsService', () => {
  let prisma: {
    lactation: { findFirst: jest.Mock };
    milkDispatch: { findFirst: jest.Mock };
    milkBuyer: { findMany: jest.Mock };
    feedDistribution: { findMany: jest.Mock };
    cattle: { count: jest.Mock };
    expense: { findMany: jest.Mock };
    animalSaleLine: { findMany: jest.Mock };
  };
  let logger: { setContext: jest.Mock };
  let lactationStatsService: { getStats: jest.Mock };

  const lactationRow = {
    id: 'lact-1',
    cattleId: 'cattle-1',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: null,
    cattle: { tagNumber: 'T-001', feedGroupId: 'fg-1' },
  };

  const baseStats = {
    today: 20,
    sevenDayAvgYield: 18,
    thirtyDayAvgYield: 17,
    lactationToDate: {
      produced: 500,
      saleable: 450,
      withheld: 30,
      colostrum: 0,
      calfFeed: 0,
      discarded: 20,
      householdUse: 0,
    },
    peak: { yieldL: 25, date: new Date('2026-07-10'), dim: 9 },
    persistency: {
      currentSevenDayAvgYield: 18,
      peakMilkYield: 25,
      peakDaysInMilk: 9,
      daysSincePeak: 20,
      persistencyPct: 72,
      declinePct: 28,
    },
  };

  beforeEach(() => {
    prisma = {
      lactation: { findFirst: jest.fn().mockResolvedValue(lactationRow) },
      milkDispatch: { findFirst: jest.fn().mockResolvedValue(null) },
      milkBuyer: { findMany: jest.fn().mockResolvedValue([]) },
      feedDistribution: { findMany: jest.fn().mockResolvedValue([]) },
      cattle: { count: jest.fn().mockResolvedValue(0) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
      animalSaleLine: { findMany: jest.fn().mockResolvedValue([]) },
    };
    logger = { setContext: jest.fn() };
    lactationStatsService = {
      getStats: jest.fn().mockResolvedValue(baseStats),
    };
  });

  const make = () =>
    new LactationEconomicsService(
      prisma as never,
      logger as never,
      lactationStatsService as never,
    );

  describe('getEconomics', () => {
    it('404s when the lactation does not belong to the active farm', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(service.getEconomics('farm-1', 'lact-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.lactation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lact-1', cattle: { farmId: 'farm-1' } },
        }),
      );
    });

    it('reuses getStats() for biological data + saleable/withheld/discarded litres', async () => {
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(lactationStatsService.getStats).toHaveBeenCalledWith(
        'farm-1',
        'lact-1',
      );
      expect(result.biological).toEqual(
        expect.objectContaining({
          today: 20,
          sevenDayAvgYield: 18,
          thirtyDayAvgYield: 17,
          peak: baseStats.peak,
          persistency: baseStats.persistency,
        }),
      );
      expect(result.financial.saleableLitres).toBe(450);
      expect(result.financial.withheldLitres).toBe(30);
      expect(result.financial.discardedLitres).toBe(20);
    });

    it('prefers the most recent MilkDispatch rate over the buyer base price', async () => {
      prisma.milkDispatch.findFirst.mockResolvedValueOnce({
        basePricePerLitre: 60,
      });
      prisma.milkBuyer.findMany.mockResolvedValueOnce([
        { basePricePerLitre: 50 },
      ]);
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(result.financial.effectiveMilkRatePerLitre).toBe(60);
      expect(result.financial.milkRevenue).toBe(450 * 60);
      expect(prisma.milkBuyer.findMany).not.toHaveBeenCalled();
    });

    it('falls back to the average of active buyer base prices when no dispatch exists', async () => {
      prisma.milkBuyer.findMany.mockResolvedValueOnce([
        { basePricePerLitre: 50 },
        { basePricePerLitre: 60 },
      ]);
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(result.financial.effectiveMilkRatePerLitre).toBe(55);
    });

    it('falls back to a 0 rate when the farm has no dispatch and no active buyer', async () => {
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(result.financial.effectiveMilkRatePerLitre).toBe(0);
      expect(result.financial.milkRevenue).toBe(0);
    });

    it('values discarded/withheld litres as a cost at the same effective rate', async () => {
      prisma.milkDispatch.findFirst.mockResolvedValueOnce({
        basePricePerLitre: 10,
      });
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      // withheld 30 + discarded 20 = 50L * 10 = 500
      expect(result.financial.discardedWithheldValue).toBe(500);
    });

    it("sums the cow's own individual FeedDistribution rows in full", async () => {
      prisma.feedDistribution.findMany.mockResolvedValueOnce([
        { cattleId: 'cattle-1', feedGroupId: null, totalActualCost: 200 },
      ]);
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(result.financial.feedCost).toBe(200);
      expect(prisma.cattle.count).not.toHaveBeenCalled();
    });

    it('pro-rates group-targeted FeedDistribution rows across the feed group headcount', async () => {
      prisma.feedDistribution.findMany.mockResolvedValueOnce([
        { cattleId: null, feedGroupId: 'fg-1', totalActualCost: 1000 },
      ]);
      prisma.cattle.count.mockResolvedValueOnce(10);
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(prisma.cattle.count).toHaveBeenCalledWith({
        where: { farmId: 'farm-1', feedGroupId: 'fg-1', isActive: true },
      });
      expect(result.financial.feedCost).toBe(100);
    });

    it('allocates 0 feed cost when the cow has no individual distribution and no feed group', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce({
        ...lactationRow,
        cattle: { tagNumber: 'T-002', feedGroupId: null },
      });
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(result.financial.feedCost).toBe(0);
      const calls = prisma.feedDistribution.findMany.mock.calls as unknown[][];
      const call = calls[0][0] as { where: { OR: unknown } };
      expect(call.where.OR).toEqual([{ cattleId: 'cattle-1' }]);
    });

    it('sums breeding cost via the shared computeCattleFinance aggregation; medicine reads 0 (RAKHAL-352/354)', async () => {
      // RAKHAL-352: `getEconomics` reads both buckets off a single
      // `computeCattleFinance()` call (the same shared aggregation
      // `CattleDetailService.cattleFinance()` uses). RAKHAL-354: V1
      // `FinanceTransaction` (the health/breeding source at the time
      // RAKHAL-352 landed) is dropped — breeding now reads real V2
      // `Expense.cattleId` rows (`category: BREEDING`); health has no V2
      // source yet and structurally reads 0 (documented gap, not a bug).
      prisma.expense.findMany.mockResolvedValueOnce([{ amount: 150 }]);
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(result.financial.medicineCost).toBe(0);
      expect(result.financial.breedingCost).toBe(150);
      const expenseCalls = prisma.expense.findMany.mock.calls as unknown[][];
      const firstCall = expenseCalls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(firstCall.where).toEqual(
        expect.objectContaining({
          farmId: 'farm-1',
          cattleId: 'cattle-1',
          category: ExpenseCategory.BREEDING,
        }),
      );
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- nested `expect.objectContaining` typed `any` by @jest/expect, same pre-existing pattern elsewhere in this suite */
      expect(prisma.animalSaleLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cattleId: 'cattle-1' }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('computes margin = milkRevenue - (feed + medicine + breeding + discardedWithheldValue)', async () => {
      prisma.milkDispatch.findFirst.mockResolvedValueOnce({
        basePricePerLitre: 10,
      });
      prisma.feedDistribution.findMany.mockResolvedValueOnce([
        { cattleId: 'cattle-1', feedGroupId: null, totalActualCost: 100 },
      ]);
      // RAKHAL-354: health has no V2 source (reads 0); breeding reads real
      // V2 `Expense.cattleId` rows.
      prisma.expense.findMany.mockResolvedValueOnce([{ amount: 25 }]);
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      // milkRevenue = 450 * 10 = 4500; discardedWithheldValue = 50 * 10 = 500
      // totalCost = 100 (feed) + 0 (health) + 25 (breeding) + 500 = 625
      // margin = 4500 - 625 = 3875
      expect(result.financial.milkRevenue).toBe(4500);
      expect(result.financial.totalCost).toBe(625);
      expect(result.financial.margin).toBe(3875);
    });
  });
});
