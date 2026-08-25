import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MilkAvailabilityService } from './milk-availability.service';

/**
 * RAKHAL-343 — availability read model + row-lock seam, against a mocked
 * Prisma (same direct-instantiation style as `milk-quality.service.spec.ts`).
 * The real concurrency proof (two parallel `SellMilkUseCase.execute()` calls
 * racing `lockAndValidate` under a live Postgres) lives in
 * `test/rakhal-343-milk-availability.e2e-spec.ts` — a mock can prove the
 * shape of the query and the throw conditions, never actual lock contention.
 */
describe('MilkAvailabilityService', () => {
  let prisma: {
    milkTank: { findFirst: jest.Mock; findMany: jest.Mock };
  };
  let logger: { setContext: jest.Mock; info: jest.Mock };

  beforeEach(() => {
    prisma = {
      milkTank: { findFirst: jest.fn(), findMany: jest.fn() },
    };
    logger = { setContext: jest.fn().mockReturnThis(), info: jest.fn() };
  });

  const make = () =>
    new MilkAvailabilityService(prisma as never, logger as never);

  describe('getAvailability', () => {
    it('lists active SELLABLE tanks scoped to the farm, fullest first', async () => {
      prisma.milkTank.findMany.mockResolvedValueOnce([
        { id: 'tank-1', name: 'Main', currentVolumeL: 80, totalCapacityL: 100 },
        {
          id: 'tank-2',
          name: 'Overflow',
          currentVolumeL: 20,
          totalCapacityL: 50,
        },
      ]);
      const service = make();

      const result = await service.getAvailability('farm-1');

      expect(prisma.milkTank.findMany).toHaveBeenCalledWith({
        where: { farmId: 'farm-1', tankType: 'SELLABLE', isActive: true },
        select: {
          id: true,
          name: true,
          currentVolumeL: true,
          totalCapacityL: true,
        },
        orderBy: { currentVolumeL: 'desc' },
      });
      expect(result.tanks).toEqual([
        {
          tankId: 'tank-1',
          tankName: 'Main',
          availableL: 80,
          totalCapacityL: 100,
        },
        {
          tankId: 'tank-2',
          tankName: 'Overflow',
          availableL: 20,
          totalCapacityL: 50,
        },
      ]);
      expect(result.totalAvailableL).toBe(100);
    });

    it('scopes to a single tank when tankId is given, 404s if missing', async () => {
      prisma.milkTank.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.getAvailability('farm-1', 'tank-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns just the named tank when found', async () => {
      prisma.milkTank.findFirst.mockResolvedValueOnce({
        id: 'tank-1',
        name: 'Main',
        currentVolumeL: 45,
        totalCapacityL: 100,
      });
      const service = make();

      const result = await service.getAvailability('farm-1', 'tank-1');

      expect(result.tanks).toEqual([
        {
          tankId: 'tank-1',
          tankName: 'Main',
          availableL: 45,
          totalCapacityL: 100,
        },
      ]);
      expect(result.totalAvailableL).toBe(45);
    });
  });

  describe('lockAndValidate', () => {
    const makeTx = (rows: Array<{ id: string; currentVolumeL: number }>) => {
      const queryRaw = jest.fn().mockResolvedValueOnce(rows);
      return { $queryRaw: queryRaw } as never;
    };

    it('throws NotFoundException when the locked row does not exist', async () => {
      const service = make();
      const tx = makeTx([]);

      await expect(
        service.lockAndValidate('farm-1', 'tank-1', 10, tx),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the locked volume is short', async () => {
      const service = make();
      const tx = makeTx([{ id: 'tank-1', currentVolumeL: 5 }]);

      await expect(
        service.lockAndValidate('farm-1', 'tank-1', 10, tx),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns the locked row when the volume covers the request', async () => {
      const service = make();
      const tx = makeTx([{ id: 'tank-1', currentVolumeL: 100 }]);

      const result = await service.lockAndValidate('farm-1', 'tank-1', 80, tx);

      expect(result).toEqual({ id: 'tank-1', currentVolumeL: 100 });
    });

    it('issues a FOR UPDATE query scoped to the farm and tank', async () => {
      const service = make();
      const queryRaw = jest
        .fn()
        .mockResolvedValueOnce([{ id: 'tank-1', currentVolumeL: 100 }]);
      const tx = { $queryRaw: queryRaw } as never;

      await service.lockAndValidate('farm-1', 'tank-1', 10, tx);

      expect(queryRaw).toHaveBeenCalledTimes(1);
      const calls = queryRaw.mock.calls as unknown as Array<
        [{ sql: string; values: unknown[] }]
      >;
      const sqlArg = calls[0][0];
      expect(sqlArg.sql).toContain('FOR UPDATE');
      expect(sqlArg.sql).toContain('"MilkTank"');
      expect(sqlArg.values).toEqual(['tank-1', 'farm-1']);
      // (verified against the real `Prisma.sql` shape — `.sql`/`.values` are
      // real getters even though they don't show up in `Object.keys`)
    });
  });
});
