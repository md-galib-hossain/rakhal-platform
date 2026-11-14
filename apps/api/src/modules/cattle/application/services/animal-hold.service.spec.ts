import { NotFoundException } from '@nestjs/common';
import { AnimalHoldService } from './animal-hold.service';

/**
 * RAKHAL-280 — generic AnimalHold mechanism. Covers create/release/query
 * against mocked Prisma + ActivityLogService (same style as
 * `cattle.service.spec.ts`).
 */
describe('AnimalHoldService', () => {
  let prisma: {
    cattle: { findFirst: jest.Mock };
    animalHold: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let activityLog: { record: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock };

  const cattleRow = { id: 'cattle-1', tagNumber: 'T-001' };

  beforeEach(() => {
    prisma = {
      cattle: { findFirst: jest.fn().mockResolvedValue(cattleRow) },
      animalHold: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    activityLog = { record: jest.fn().mockResolvedValue(undefined) };
    logger = { setContext: jest.fn().mockReturnThis(), info: jest.fn() };
  });

  const make = () =>
    new AnimalHoldService(
      prisma as never,
      activityLog as never,
      logger as never,
    );

  describe('createHold', () => {
    it('404s when cattle is not in the farm', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.createHold('farm-1', 'user-1', 'cattle-x', {
          type: 'REPRODUCTIVE',
          reason: 'awaiting confirmation',
        } as never),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.animalHold.create).not.toHaveBeenCalled();
    });

    it('creates a hold scoped to the farm + cattle and records activity', async () => {
      const created = {
        id: 'hold-1',
        farmId: 'farm-1',
        cattleId: 'cattle-1',
        type: 'MILK_DISCARD',
        reason: 'antibiotic withdrawal',
        startedAt: new Date(),
        endedAt: null,
        createdBy: 'user-1',
        releasedBy: null,
      };
      prisma.animalHold.create.mockResolvedValueOnce(created);
      const service = make();

      const result = await service.createHold('farm-1', 'user-1', 'cattle-1', {
        type: 'MILK_DISCARD',
        reason: 'antibiotic withdrawal',
      } as never);

      expect(prisma.animalHold.create).toHaveBeenCalledWith({
        data: {
          farmId: 'farm-1',
          cattleId: 'cattle-1',
          type: 'MILK_DISCARD',
          reason: 'antibiotic withdrawal',
          createdBy: 'user-1',
        },
      });
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          farmId: 'farm-1',
          actorId: 'user-1',
          relatedCattleId: 'cattle-1',
        }),
      );
      expect(result).toBe(created);
    });
  });

  describe('releaseHold', () => {
    it('404s when the hold does not exist in the farm/cattle scope', async () => {
      prisma.animalHold.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.releaseHold('farm-1', 'cattle-1', 'hold-x', 'user-2'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.animalHold.update).not.toHaveBeenCalled();
    });

    it('is idempotent when the hold is already released', async () => {
      const already = {
        id: 'hold-1',
        farmId: 'farm-1',
        cattleId: 'cattle-1',
        type: 'QUARANTINE',
        endedAt: new Date('2026-01-01'),
        releasedBy: 'user-1',
      };
      prisma.animalHold.findFirst.mockResolvedValueOnce(already);
      const service = make();

      const result = await service.releaseHold(
        'farm-1',
        'cattle-1',
        'hold-1',
        'user-2',
      );

      expect(prisma.animalHold.update).not.toHaveBeenCalled();
      expect(activityLog.record).not.toHaveBeenCalled();
      expect(result).toBe(already);
    });

    it('sets endedAt + releasedBy and records activity', async () => {
      prisma.animalHold.findFirst.mockResolvedValueOnce({
        id: 'hold-1',
        farmId: 'farm-1',
        cattleId: 'cattle-1',
        type: 'OTHER',
        endedAt: null,
        releasedBy: null,
      });
      const released = {
        id: 'hold-1',
        farmId: 'farm-1',
        cattleId: 'cattle-1',
        type: 'OTHER',
        endedAt: new Date(),
        releasedBy: 'user-2',
      };
      prisma.animalHold.update.mockResolvedValueOnce(released);
      const service = make();

      const result = await service.releaseHold(
        'farm-1',
        'cattle-1',
        'hold-1',
        'user-2',
        { note: 'resolved' },
      );

      expect(prisma.animalHold.update).toHaveBeenCalledWith({
        where: { id: 'hold-1' },
        data: {
          endedAt: expect.any(Date) as Date,
          releasedBy: 'user-2',
        },
      });
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          farmId: 'farm-1',
          actorId: 'user-2',
          relatedCattleId: 'cattle-1',
          actionDetails: expect.stringContaining('resolved') as string,
        }),
      );
      expect(result).toBe(released);
    });
  });

  describe('activeHoldsForCattle', () => {
    it('queries only active (endedAt: null) holds, optionally by type', async () => {
      prisma.animalHold.findMany.mockResolvedValueOnce([]);
      const service = make();

      await service.activeHoldsForCattle('farm-1', 'cattle-1', 'REPRODUCTIVE');

      expect(prisma.animalHold.findMany).toHaveBeenCalledWith({
        where: {
          farmId: 'farm-1',
          cattleId: 'cattle-1',
          endedAt: null,
          type: 'REPRODUCTIVE',
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('omits the type filter when not given', async () => {
      prisma.animalHold.findMany.mockResolvedValueOnce([]);
      const service = make();

      await service.activeHoldsForCattle('farm-1', 'cattle-1');

      expect(prisma.animalHold.findMany).toHaveBeenCalledWith({
        where: {
          farmId: 'farm-1',
          cattleId: 'cattle-1',
          endedAt: null,
        },
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('list', () => {
    it('404s when cattle is not in the farm', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.list('farm-1', 'cattle-x', {
          limit: 20,
          sortOrder: 'desc',
          includeReleased: false,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('defaults to active-only (endedAt: null) unless includeReleased is set', async () => {
      prisma.animalHold.findMany.mockResolvedValueOnce([]);
      const service = make();

      await service.list('farm-1', 'cattle-1', {
        limit: 20,
        sortOrder: 'desc',
        includeReleased: false,
      } as never);

      const calls = prisma.animalHold.findMany.mock.calls as unknown as Array<
        [{ where: Record<string, unknown> }]
      >;
      const call = calls[0][0];
      expect(call.where).toMatchObject({
        farmId: 'farm-1',
        cattleId: 'cattle-1',
        endedAt: null,
      });
    });

    it('includes released holds when includeReleased is true', async () => {
      prisma.animalHold.findMany.mockResolvedValueOnce([]);
      const service = make();

      await service.list('farm-1', 'cattle-1', {
        limit: 20,
        sortOrder: 'desc',
        includeReleased: true,
      } as never);

      const calls = prisma.animalHold.findMany.mock.calls as unknown as Array<
        [{ where: Record<string, unknown> }]
      >;
      const call = calls[0][0];
      expect(call.where.endedAt).toBeUndefined();
    });
  });
});
