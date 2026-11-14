import { NotFoundException } from '@nestjs/common';
import { MilkDisposition, MilkSession } from '@prisma/client';
import { LactationStatsService } from './lactation-stats.service';

/**
 * RAKHAL-283 — read-only lactation stats + curve. Mocked Prisma + Logger +
 * FarmSettingsService, direct-instantiation pattern (matches
 * `animal-hold.service.spec.ts`/`cattle.service.spec.ts`'s precedent) since
 * this service has no side effects to verify via a real Nest TestingModule.
 */
describe('LactationStatsService', () => {
  let prisma: {
    lactation: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    milkLogEntry: { findMany: jest.Mock };
  };
  let farmSettings: {
    milkActiveSessions: jest.Mock;
    minDimFor305DayYield: jest.Mock;
  };
  let logger: { setContext: jest.Mock };

  const lactationRow = {
    id: 'lact-1',
    cattleId: 'cattle-1',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: null,
    cattle: { tagNumber: 'T-001' },
  };

  beforeEach(() => {
    prisma = {
      lactation: {
        findFirst: jest.fn().mockResolvedValue(lactationRow),
        // RAKHAL-285's dry-off-projection lookup (prior lactations for this
        // cow) — mocked here too since it now shares `getStats()` with this
        // ticket's peak/persistency read; not otherwise exercised by these
        // RAKHAL-284 tests.
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      milkLogEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    farmSettings = {
      milkActiveSessions: jest
        .fn()
        .mockResolvedValue([MilkSession.MORNING, MilkSession.EVENING]),
      // RAKHAL-285: gates `standardized305DayYield` — 30 by default.
      minDimFor305DayYield: jest.fn().mockResolvedValue(30),
    };
    logger = { setContext: jest.fn() };
  });

  const make = () =>
    new LactationStatsService(
      prisma as never,
      logger as never,
      farmSettings as never,
    );

  describe('getStats', () => {
    it('404s when the lactation does not belong to the active farm', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(service.getStats('farm-1', 'lact-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.lactation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lact-1', cattle: { farmId: 'farm-1' } },
        }),
      );
    });

    it('returns today/7d/30d yield and lactation-to-date totals by disposition', async () => {
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        {
          logDate: new Date('2026-07-01T05:00:00.000Z'),
          yieldL: 10,
          disposition: MilkDisposition.SALEABLE,
        },
        {
          logDate: new Date('2026-07-02T05:00:00.000Z'),
          yieldL: 4,
          disposition: MilkDisposition.WITHHELD,
        },
      ]);
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.lactationId).toBe('lact-1');
      expect(stats.cattleId).toBe('cattle-1');
      expect(stats.tagNumber).toBe('T-001');
      expect(stats.lactationToDate).toEqual({
        produced: 14,
        saleable: 10,
        withheld: 4,
        colostrum: 0,
        calfFeed: 0,
        discarded: 0,
        householdUse: 0,
      });
    });

    it('returns null peak/persistency when no peak has been recorded yet (RAKHAL-284)', async () => {
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([]);
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.peak).toBeNull();
      expect(stats.persistency).toBeNull();
    });

    it('surfaces the stored peak and derives persistency from the current 7-day average (RAKHAL-284)', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce({
        ...lactationRow,
        peakMilkYield: 25,
        peakMilkDate: new Date('2026-07-10T00:00:00.000Z'),
        peakDaysInMilk: 9,
      });
      // 7-day window ending 2026-07-20 (DIM 19): one 20L entry inside it.
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        {
          logDate: new Date('2026-07-20T00:00:00.000Z'),
          yieldL: 20,
          disposition: MilkDisposition.SALEABLE,
        },
      ]);
      jest.useFakeTimers().setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.peak).toEqual({
        yieldL: 25,
        date: new Date('2026-07-10T00:00:00.000Z'),
        dim: 9,
      });
      expect(stats.persistency?.peakMilkYield).toBe(25);
      expect(stats.persistency?.peakDaysInMilk).toBe(9);
      expect(stats.persistency?.daysSincePeak).toBe(10); // DIM 19 - peakDaysInMilk 9
      expect(typeof stats.persistency?.currentSevenDayAvgYield).toBe('number');
      expect(typeof stats.persistency?.persistencyPct).toBe('number');
      expect(typeof stats.persistency?.declinePct).toBe('number');
      jest.useRealTimers();
    });

    it('pregnant (RAKHAL-285): surfaces the stored recommendedDryOffAt directly, no management estimate attached', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce({
        ...lactationRow,
        recommendedDryOffAt: new Date('2026-11-02T00:00:00.000Z'),
        plannedDryOffAt: null,
      });
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.recommendedDryOffAt).toEqual(
        new Date('2026-11-02T00:00:00.000Z'),
      );
      expect(stats.managementEstimateDimRange).toBeNull();
      expect(stats.dryOffConfidence).toBeNull();
      expect(stats.dryOffProjectionReason).toBeNull();
      // Pregnant path never needs the prior-lactation lookup.
      expect(prisma.lactation.findMany).not.toHaveBeenCalled();
    });

    it('not pregnant (RAKHAL-285): recommendedDryOffAt is null and a labeled LOW-confidence management estimate is derived from prior lactation lengths', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce({
        ...lactationRow,
        recommendedDryOffAt: null,
        plannedDryOffAt: null,
      });
      prisma.lactation.findMany.mockResolvedValueOnce([
        {
          startDate: new Date('2025-01-01T00:00:00.000Z'),
          endDate: new Date('2025-10-28T00:00:00.000Z'), // 300 days
        },
      ]);
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.recommendedDryOffAt).toBeNull();
      expect(stats.managementEstimateDimRange).toEqual([285, 315]);
      expect(stats.dryOffConfidence).toBe('LOW');
      expect(stats.dryOffProjectionReason).toEqual(
        expect.stringContaining('Not pregnant'),
      );
      expect(prisma.lactation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            cattleId: 'cattle-1',
            id: { not: 'lact-1' },
            endDate: { not: null },
          },
        }),
      );
    });

    it('plannedDryOffAt (RAKHAL-285) is surfaced as-is from the stored field, independent of recommendedDryOffAt', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce({
        ...lactationRow,
        recommendedDryOffAt: null,
        plannedDryOffAt: new Date('2026-12-01T00:00:00.000Z'),
      });
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.plannedDryOffAt).toEqual(
        new Date('2026-12-01T00:00:00.000Z'),
      );
    });

    it('standardized305DayYield (RAKHAL-285) is null below the configured minimum DIM threshold', async () => {
      farmSettings.minDimFor305DayYield.mockResolvedValueOnce(30);
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z')); // DIM 14
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        {
          logDate: new Date('2026-07-01T05:00:00.000Z'),
          yieldL: 10,
          disposition: MilkDisposition.SALEABLE,
        },
      ]);
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.standardized305DayYield).toBeNull();
      jest.useRealTimers();
    });

    it('standardized305DayYield (RAKHAL-285) projects a value at/above the configured minimum DIM threshold', async () => {
      farmSettings.minDimFor305DayYield.mockResolvedValueOnce(10);
      // DIM = 10 (2026-07-01 .. 2026-07-11 inclusive), 100L produced -> 10 L/day avg.
      jest.useFakeTimers().setSystemTime(new Date('2026-07-11T00:00:00.000Z'));
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        {
          logDate: new Date('2026-07-05T05:00:00.000Z'),
          yieldL: 100,
          disposition: MilkDisposition.SALEABLE,
        },
      ]);
      const service = make();

      const stats = await service.getStats('farm-1', 'lact-1');

      expect(stats.standardized305DayYield).toBe(3050);
      jest.useRealTimers();
    });
  });

  describe('updatePlannedDryOff (RAKHAL-285)', () => {
    it('404s when the lactation does not belong to the active farm', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.updatePlannedDryOff('farm-1', 'lact-1', new Date('2026-12-01')),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.lactation.update).not.toHaveBeenCalled();
    });

    it('writes plannedDryOffAt without touching recommendedDryOffAt', async () => {
      const service = make();

      await service.updatePlannedDryOff(
        'farm-1',
        'lact-1',
        new Date('2026-12-01T00:00:00.000Z'),
      );

      expect(prisma.lactation.update).toHaveBeenCalledWith({
        where: { id: 'lact-1' },
        data: { plannedDryOffAt: new Date('2026-12-01T00:00:00.000Z') },
      });
    });

    it('clears plannedDryOffAt when passed null', async () => {
      const service = make();

      await service.updatePlannedDryOff('farm-1', 'lact-1', null);

      expect(prisma.lactation.update).toHaveBeenCalledWith({
        where: { id: 'lact-1' },
        data: { plannedDryOffAt: null },
      });
    });
  });

  describe('getCurve', () => {
    it('404s when the lactation does not belong to the active farm', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(service.getCurve('farm-1', 'lact-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('builds a series from the lactation start date through now, using the farm active sessions', async () => {
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        {
          logDate: new Date('2026-07-01T05:00:00.000Z'),
          session: MilkSession.MORNING,
          yieldL: 6,
        },
      ]);
      const service = make();

      const result = await service.getCurve('farm-1', 'lact-1');

      expect(result.lactationId).toBe('lact-1');
      expect(result.compareLactationId).toBeNull();
      expect(result.compareSeries).toBeNull();
      expect(result.series.length).toBeGreaterThan(0);
      expect(result.series[0].dim).toBe(0);
      expect(farmSettings.milkActiveSessions).toHaveBeenCalledWith('farm-1');
    });

    it('also resolves and returns a compareSeries when compareLactationId is supplied', async () => {
      const compareLactationRow = {
        id: 'lact-2',
        cattleId: 'cattle-2',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-06-10T00:00:00.000Z'),
        cattle: { tagNumber: 'T-002' },
      };
      prisma.lactation.findFirst
        .mockResolvedValueOnce(lactationRow)
        .mockResolvedValueOnce(compareLactationRow);
      prisma.milkLogEntry.findMany.mockResolvedValue([]);
      const service = make();

      const result = await service.getCurve('farm-1', 'lact-1', 'lact-2');

      expect(result.compareLactationId).toBe('lact-2');
      expect(result.compareCattleId).toBe('cattle-2');
      expect(result.compareSeries).not.toBeNull();
      expect(result.compareSeries?.length).toBe(10); // June 1..10 inclusive
    });

    it('falls back to the default session config when the farm has none configured', async () => {
      farmSettings.milkActiveSessions.mockResolvedValueOnce([]);
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([]);
      const service = make();

      const result = await service.getCurve('farm-1', 'lact-1');

      // DEFAULT_SESSION_CONFIG has 3 sessions (MORNING/NOON/EVENING)
      expect(result.series[0].sessionsExpected).toBe(3);
    });
  });

  describe('compareLactations (RAKHAL-287)', () => {
    const currentLactationRow = {
      id: 'lact-cur',
      cattleId: 'cattle-1',
      lactationNumber: 2,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: null,
      peakMilkYield: 25,
      peakMilkDate: new Date('2026-07-10T00:00:00.000Z'),
      peakDaysInMilk: 9,
      recommendedDryOffAt: null,
      plannedDryOffAt: null,
      cattle: { tagNumber: 'T-001' },
    };
    const previousLactationRow = {
      id: 'lact-prev',
      cattleId: 'cattle-1',
      lactationNumber: 1,
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-10-28T00:00:00.000Z'),
      peakMilkYield: 20,
      peakMilkDate: new Date('2025-01-15T00:00:00.000Z'),
      peakDaysInMilk: 14,
      recommendedDryOffAt: null,
      plannedDryOffAt: null,
      cattle: { tagNumber: 'T-001' },
    };

    it('404s when the cow has no active lactation on this farm', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.compareLactations('farm-1', 'cattle-1', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('byLactationNumber=true resolves the previous lactation as lactationNumber - 1', async () => {
      prisma.lactation.findFirst
        .mockResolvedValueOnce(currentLactationRow) // getCurrentLactationOrThrow
        .mockResolvedValueOnce(previousLactationRow); // findLactationByNumber
      prisma.milkLogEntry.findMany.mockResolvedValue([]);
      const service = make();

      const result = await service.compareLactations(
        'farm-1',
        'cattle-1',
        true,
      );

      expect(prisma.lactation.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            cattleId: 'cattle-1',
            lactationNumber: 1,
            cattle: { farmId: 'farm-1' },
          },
        }),
      );
      expect(result.current.lactationId).toBe('lact-cur');
      expect(result.previous?.lactationId).toBe('lact-prev');
      expect(result.byLactationNumber).toBe(true);
    });

    it('byLactationNumber=false resolves the previous lactation as the most recently ended one', async () => {
      prisma.lactation.findFirst
        .mockResolvedValueOnce(currentLactationRow)
        .mockResolvedValueOnce(previousLactationRow);
      prisma.milkLogEntry.findMany.mockResolvedValue([]);
      const service = make();

      await service.compareLactations('farm-1', 'cattle-1', false);

      expect(prisma.lactation.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            cattleId: 'cattle-1',
            id: { not: 'lact-cur' },
            endDate: { not: null },
            cattle: { farmId: 'farm-1' },
          },
          orderBy: [{ endDate: 'desc' }],
        }),
      );
    });

    it('previous is null (not an error) when the cow has no prior lactation', async () => {
      prisma.lactation.findFirst
        .mockResolvedValueOnce(currentLactationRow)
        .mockResolvedValueOnce(null);
      prisma.milkLogEntry.findMany.mockResolvedValue([]);
      const service = make();

      const result = await service.compareLactations(
        'farm-1',
        'cattle-1',
        true,
      );

      expect(result.previous).toBeNull();
      expect(result.alignedSeries.every((p) => p.previousYieldL === null)).toBe(
        true,
      );
    });

    it('DIM-aligns the two series by dim, not calendar date (integration-level check — pure-function behavior is covered in lactation-comparison.spec.ts)', async () => {
      prisma.lactation.findFirst
        .mockResolvedValueOnce(currentLactationRow)
        .mockResolvedValueOnce(previousLactationRow);
      // current: 6L on its own dim 0 (2026-07-01). previous: 4L on its own dim 0 (2025-01-01).
      prisma.milkLogEntry.findMany
        .mockResolvedValueOnce([]) // buildSeriesFor(current) curve entries
        .mockResolvedValueOnce([]) // buildSeriesFor(previous) curve entries
        .mockResolvedValueOnce([]) // buildComparisonSummary(current) yield entries
        .mockResolvedValueOnce([]); // buildComparisonSummary(previous) yield entries
      const service = make();

      const result = await service.compareLactations(
        'farm-1',
        'cattle-1',
        true,
      );

      expect(result.alignedSeries[0].dim).toBe(0);
    });
  });

  describe('compareGroups (RAKHAL-287)', () => {
    it('returns an empty array when the farm has no active lactations', async () => {
      prisma.lactation.findMany.mockResolvedValueOnce([]);
      const service = make();

      const result = await service.compareGroups('farm-1', 'parity');

      expect(result).toEqual([]);
      expect(prisma.milkLogEntry.findMany).not.toHaveBeenCalled();
    });

    it('buckets by parity and averages sevenDayAvgYield across cows in the same bucket', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
      prisma.lactation.findMany.mockResolvedValueOnce([
        {
          id: 'lact-a',
          cattleId: 'cattle-a',
          lactationNumber: 1,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: null,
          peakMilkYield: 20,
          peakDaysInMilk: 5,
          cattle: {
            shedId: null,
            shed: null,
          },
        },
        {
          id: 'lact-b',
          cattleId: 'cattle-b',
          lactationNumber: 1,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: null,
          peakMilkYield: 30,
          peakDaysInMilk: 5,
          cattle: {
            shedId: null,
            shed: null,
          },
        },
      ]);
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        {
          cattleId: 'cattle-a',
          logDate: new Date('2026-07-14T00:00:00.000Z'),
          yieldL: 10,
          disposition: MilkDisposition.SALEABLE,
        },
        {
          cattleId: 'cattle-b',
          logDate: new Date('2026-07-14T00:00:00.000Z'),
          yieldL: 20,
          disposition: MilkDisposition.SALEABLE,
        },
      ]);
      const service = make();

      const result = await service.compareGroups('farm-1', 'parity');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        bucketKey: '1',
        bucketLabel: 'Parity 1',
        cowCount: 2,
      });
      jest.useRealTimers();
    });

    it('buckets by shed, labeling an unassigned cow as "Unassigned"', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
      prisma.lactation.findMany.mockResolvedValueOnce([
        {
          id: 'lact-a',
          cattleId: 'cattle-a',
          lactationNumber: 1,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: null,
          peakMilkYield: null,
          peakDaysInMilk: null,
          cattle: {
            shedId: 'shed-1',
            shed: { name: 'Shed A' },
          },
        },
        {
          id: 'lact-b',
          cattleId: 'cattle-b',
          lactationNumber: 1,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: null,
          peakMilkYield: null,
          peakDaysInMilk: null,
          cattle: {
            shedId: null,
            shed: null,
          },
        },
      ]);
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([]);
      const service = make();

      const result = await service.compareGroups('farm-1', 'shed');

      expect(result).toHaveLength(2);
      expect(result.find((b) => b.bucketKey === 'shed-1')?.bucketLabel).toBe(
        'Shed A',
      );
      expect(
        result.find((b) => b.bucketKey === 'UNASSIGNED')?.bucketLabel,
      ).toBe('Unassigned');
      jest.useRealTimers();
    });

    it('buckets by dimRange', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T00:00:00.000Z')); // DIM ~76 from 2026-07-01
      prisma.lactation.findMany.mockResolvedValueOnce([
        {
          id: 'lact-a',
          cattleId: 'cattle-a',
          lactationNumber: 1,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: null,
          peakMilkYield: null,
          peakDaysInMilk: null,
          cattle: {
            shedId: null,
            shed: null,
          },
        },
      ]);
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([]);
      const service = make();

      const result = await service.compareGroups('farm-1', 'dimRange');

      expect(result).toHaveLength(1);
      expect(result[0].bucketKey).toBe('61-120');
      jest.useRealTimers();
    });
  });
});
