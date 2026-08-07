import { NotFoundException } from '@nestjs/common';
import { FinanceTxnType } from '@prisma/client';
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
    financeTransaction: { findMany: jest.Mock };
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
      financeTransaction: { findMany: jest.fn().mockResolvedValue([]) },
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

    it('sums medicine and breeding costs from non-void FinanceTransaction rows by subType', async () => {
      prisma.financeTransaction.findMany
        .mockResolvedValueOnce([{ amount: 300 }, { amount: 200 }]) // health
        .mockResolvedValueOnce([{ amount: 150 }]); // breeding
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      expect(result.financial.medicineCost).toBe(500);
      expect(result.financial.breedingCost).toBe(150);
      const financeCalls = prisma.financeTransaction.findMany.mock
        .calls as unknown[][];
      const firstCall = financeCalls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(firstCall.where).toEqual(
        expect.objectContaining({
          farmId: 'farm-1',
          cattleId: 'cattle-1',
          subType: 'health',
          type: {
            in: [
              FinanceTxnType.OPERATING_EXPENSE,
              FinanceTxnType.INVENTORY_PURCHASE,
            ],
          },
          isVoided: false,
          reversedTransactionId: null,
        }),
      );
    });

    it('computes margin = milkRevenue - (feed + medicine + breeding + discardedWithheldValue)', async () => {
      prisma.milkDispatch.findFirst.mockResolvedValueOnce({
        basePricePerLitre: 10,
      });
      prisma.feedDistribution.findMany.mockResolvedValueOnce([
        { cattleId: 'cattle-1', feedGroupId: null, totalActualCost: 100 },
      ]);
      prisma.financeTransaction.findMany
        .mockResolvedValueOnce([{ amount: 50 }])
        .mockResolvedValueOnce([{ amount: 25 }]);
      const service = make();
      const result = await service.getEconomics('farm-1', 'lact-1');

      // milkRevenue = 450 * 10 = 4500; discardedWithheldValue = 50 * 10 = 500
      // totalCost = 100 + 50 + 25 + 500 = 675; margin = 4500 - 675 = 3825
      expect(result.financial.milkRevenue).toBe(4500);
      expect(result.financial.totalCost).toBe(675);
      expect(result.financial.margin).toBe(3825);
    });
  });
});
