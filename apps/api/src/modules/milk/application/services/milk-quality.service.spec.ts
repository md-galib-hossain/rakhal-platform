import { NotFoundException } from '@nestjs/common';
import { MilkQualityService } from './milk-quality.service';

/**
 * RAKHAL-282 — MilkQualityTest create/list/latest against a mocked Prisma
 * (same direct-instantiation style as `animal-hold.service.spec.ts`).
 */
describe('MilkQualityService', () => {
  let prisma: {
    cattle: { findFirst: jest.Mock };
    lactation: { findFirst: jest.Mock };
    milkQualityTest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let logger: { setContext: jest.Mock; info: jest.Mock };

  const cattleRow = { id: 'cattle-1' };
  const lactationRow = { id: 'lactation-1' };

  beforeEach(() => {
    prisma = {
      cattle: { findFirst: jest.fn().mockResolvedValue(cattleRow) },
      lactation: { findFirst: jest.fn().mockResolvedValue(lactationRow) },
      milkQualityTest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    logger = { setContext: jest.fn().mockReturnThis(), info: jest.fn() };
  });

  const make = () => new MilkQualityService(prisma as never, logger as never);

  const baseDtoFields = {
    cattleId: 'cattle-1',
    lactationId: 'lactation-1',
    sampleDate: '2026-08-01',
    fatPct: 3.8,
    proteinPct: 3.2,
    lactosePct: 4.6,
    somaticCellCount: 180000,
    milkUreaNitrogen: 12,
    source: 'LAB',
    notes: 'monthly composite',
  };
  const baseDto = baseDtoFields as never;

  describe('create', () => {
    it('404s when the cow is not in the farm', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(service.create('farm-1', 'user-1', baseDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.milkQualityTest.create).not.toHaveBeenCalled();
    });

    it('404s when the lactation does not belong to the cow', async () => {
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(service.create('farm-1', 'user-1', baseDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.milkQualityTest.create).not.toHaveBeenCalled();
    });

    it('creates a quality test scoped to the farm', async () => {
      const created = { id: 'test-1', farmId: 'farm-1', ...baseDtoFields };
      prisma.milkQualityTest.create.mockResolvedValueOnce(created);
      const service = make();

      const result = await service.create('farm-1', 'user-1', baseDto);

      expect(prisma.cattle.findFirst).toHaveBeenCalledWith({
        where: { id: 'cattle-1', farmId: 'farm-1' },
        select: { id: true },
      });
      expect(prisma.lactation.findFirst).toHaveBeenCalledWith({
        where: { id: 'lactation-1', cattleId: 'cattle-1' },
        select: { id: true },
      });
      expect(prisma.milkQualityTest.create).toHaveBeenCalledWith({
        data: {
          farmId: 'farm-1',
          cattleId: 'cattle-1',
          lactationId: 'lactation-1',
          sampleDate: new Date('2026-08-01'),
          fatPct: 3.8,
          proteinPct: 3.2,
          lactosePct: 4.6,
          somaticCellCount: 180000,
          milkUreaNitrogen: 12,
          source: 'LAB',
          notes: 'monthly composite',
          createdBy: 'user-1',
        },
      });
      expect(result).toBe(created);
    });
  });

  describe('list', () => {
    it('scopes by farmId and applies optional cattleId/lactationId filters', async () => {
      prisma.milkQualityTest.findMany.mockResolvedValueOnce([]);
      const service = make();

      await service.list('farm-1', {
        limit: 20,
        sortOrder: 'desc',
        cattleId: 'cattle-1',
        lactationId: 'lactation-1',
      } as never);

      const calls = prisma.milkQualityTest.findMany.mock
        .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
      expect(calls[0][0].where).toMatchObject({
        farmId: 'farm-1',
        cattleId: 'cattle-1',
        lactationId: 'lactation-1',
      });
    });

    it('omits optional filters when not supplied', async () => {
      prisma.milkQualityTest.findMany.mockResolvedValueOnce([]);
      const service = make();

      await service.list('farm-1', { limit: 20, sortOrder: 'desc' } as never);

      const calls = prisma.milkQualityTest.findMany.mock
        .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
      expect(calls[0][0].where).toEqual({ farmId: 'farm-1' });
    });
  });

  describe('latestForCattle', () => {
    it('queries the most recent test for the cow, scoped by farm', async () => {
      prisma.milkQualityTest.findFirst.mockResolvedValueOnce(null);
      const service = make();

      const result = await service.latestForCattle('farm-1', 'cattle-1');

      expect(prisma.milkQualityTest.findFirst).toHaveBeenCalledWith({
        where: { farmId: 'farm-1', cattleId: 'cattle-1' },
        orderBy: [{ sampleDate: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toBeNull();
    });
  });
});
