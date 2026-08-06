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
    lactation: { findFirst: jest.Mock };
    milkLogEntry: { findMany: jest.Mock };
  };
  let farmSettings: { milkActiveSessions: jest.Mock };
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
      lactation: { findFirst: jest.fn().mockResolvedValue(lactationRow) },
      milkLogEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    farmSettings = {
      milkActiveSessions: jest
        .fn()
        .mockResolvedValue([MilkSession.MORNING, MilkSession.EVENING]),
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
});
