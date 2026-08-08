import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AqrService } from './aqr.service';
import { AqrConfigService } from './aqr-config.service';

/**
 * RAKHAL-304 — `previousAqrScore` capture on `applyEvent` + `reverseEvent`.
 * Uses the real `AqrConfigService` (no deps, launch-default bounds 0-100) and
 * mocked Prisma + ActivityLogService, same style as `animal-hold.service.spec.ts`.
 */
describe('AqrService', () => {
  let prisma: {
    cattle: { findFirst: jest.Mock; update: jest.Mock; aggregate: jest.Mock };
    activityLog: { findFirst: jest.Mock };
  };
  let activityLog: { record: jest.Mock };
  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
  };

  const cattleRow = {
    id: 'cattle-1',
    name: 'Bessie',
    tagNumber: 'T-001',
    aqrScore: 60,
  };

  beforeEach(() => {
    prisma = {
      cattle: {
        findFirst: jest.fn().mockResolvedValue(cattleRow),
        update: jest.fn().mockResolvedValue(undefined),
        aggregate: jest.fn(),
      },
      activityLog: { findFirst: jest.fn() },
    };
    activityLog = {
      record: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () =>
    new AqrService(
      prisma as never,
      activityLog as never,
      new AqrConfigService(),
      logger as never,
    );

  describe('applyEvent', () => {
    it('records the pre-event score as previousAqrScore', async () => {
      const service = make();

      await service.applyEvent('farm-1', 'cattle-1', 'recovered');

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ previousAqrScore: 60 }),
      );
      expect(prisma.cattle.update).toHaveBeenCalledWith({
        where: { id: 'cattle-1' },
        data: { aqrScore: 65 },
      });
    });

    it('records previousAqrScore: null for a nullifying event', async () => {
      const service = make();

      await service.applyEvent('farm-1', 'cattle-1', 'mortality');

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ previousAqrScore: 60, aqrImpact: null }),
      );
    });
  });

  describe('reverseEvent', () => {
    it('404s when the activity log entry is not found', async () => {
      prisma.activityLog.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.reverseEvent('farm-1', 'cattle-1', 'log-x'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an entry with no AQR impact', async () => {
      prisma.activityLog.findFirst.mockResolvedValueOnce({
        id: 'log-1',
        aqrImpact: null,
        previousAqrScore: null,
        module: 'COW_MANAGEMENT',
        eventTitle: 'Something Non-AQR',
      });
      const service = make();

      await expect(
        service.reverseEvent('farm-1', 'cattle-1', 'log-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('restores aqrScore to previousAqrScore exactly when present', async () => {
      prisma.activityLog.findFirst.mockResolvedValueOnce({
        id: 'log-1',
        aqrImpact: 5,
        previousAqrScore: 60,
        module: 'BREEDING',
        eventTitle: 'Pregnancy Confirmed',
      });
      // current score already moved on from the pre-event value
      prisma.cattle.findFirst.mockResolvedValueOnce({
        ...cattleRow,
        aqrScore: 65,
      });
      const service = make();

      const result = await service.reverseEvent('farm-1', 'cattle-1', 'log-1');

      expect(result.aqrScore).toBe(60);
      expect(prisma.cattle.update).toHaveBeenCalledWith({
        where: { id: 'cattle-1' },
        data: { aqrScore: 60 },
      });
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          aqrImpact: -5,
          previousAqrScore: 65,
          relatedCattleId: 'cattle-1',
        }),
      );
    });

    it('clamp-loss regression: a +50 that clamped at max reverses to the true prior score, not max-50', async () => {
      // event applied +50 to a score of 90, clamped at bound max 100 —
      // subtracting the delta naively would give 100-50=50, which is wrong;
      // the true prior score (90) is preserved via previousAqrScore.
      prisma.activityLog.findFirst.mockResolvedValueOnce({
        id: 'log-1',
        aqrImpact: 50,
        previousAqrScore: 90,
        module: 'COW_MANAGEMENT',
        eventTitle: 'Animal Registered',
      });
      prisma.cattle.findFirst.mockResolvedValueOnce({
        ...cattleRow,
        aqrScore: 100,
      });
      const service = make();

      const result = await service.reverseEvent('farm-1', 'cattle-1', 'log-1');

      expect(result.aqrScore).toBe(90);
      expect(result.aqrScore).not.toBe(50);
    });

    it('falls back to clamp(score - delta) with a warning when previousAqrScore is missing (pre-RAKHAL-304 row)', async () => {
      prisma.activityLog.findFirst.mockResolvedValueOnce({
        id: 'log-old',
        aqrImpact: 10,
        previousAqrScore: null,
        module: 'HEALTH_SAFETY',
        eventTitle: 'Animal Recovered',
      });
      prisma.cattle.findFirst.mockResolvedValueOnce({
        ...cattleRow,
        aqrScore: 70,
      });
      const service = make();

      const result = await service.reverseEvent(
        'farm-1',
        'cattle-1',
        'log-old',
      );

      expect(result.aqrScore).toBe(60);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('clamps the fallback approximation within bounds', async () => {
      prisma.activityLog.findFirst.mockResolvedValueOnce({
        id: 'log-old',
        aqrImpact: 90,
        previousAqrScore: null,
        module: 'COW_MANAGEMENT',
        eventTitle: 'Animal Registered',
      });
      prisma.cattle.findFirst.mockResolvedValueOnce({
        ...cattleRow,
        aqrScore: 50,
      });
      const service = make();

      const result = await service.reverseEvent(
        'farm-1',
        'cattle-1',
        'log-old',
      );

      // 50 - 90 = -40, clamped to bound min 0
      expect(result.aqrScore).toBe(0);
    });

    it('writes a new append-only activity log entry, never mutating the source', async () => {
      prisma.activityLog.findFirst.mockResolvedValueOnce({
        id: 'log-1',
        aqrImpact: 5,
        previousAqrScore: 60,
        module: 'BREEDING',
        eventTitle: 'Pregnancy Confirmed',
      });
      const service = make();

      await service.reverseEvent('farm-1', 'cattle-1', 'log-1');

      expect(activityLog.record).toHaveBeenCalledTimes(1);
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventTitle: 'Reversal: Pregnancy Confirmed',
        }),
      );
    });
  });
});
