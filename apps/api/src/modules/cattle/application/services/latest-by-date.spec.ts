/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */
import { BcsService } from './bcs.service';
import { WeightService } from './weight.service';

const logger = {
  setContext: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
};

function makePrisma(latestWeight: object | null, latestBcs: object | null) {
  return {
    cattle: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    weightRecord: {
      create: jest.fn().mockImplementation(({ data }) => data),
      findFirst: jest.fn().mockResolvedValue(latestWeight),
    },
    pregnancy: { findFirst: jest.fn().mockResolvedValue(null) },
    bodyConditionScore: {
      create: jest.fn().mockImplementation(({ data }) => data),
      findFirst: jest.fn().mockResolvedValue(latestBcs),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('latest-by-date denormalization (RAKHAL-477)', () => {
  it('a past-dated weight does not overwrite lastWeightKg when a newer record exists', async () => {
    const prisma = makePrisma({ weightKg: 480 }, null);
    const svc = new WeightService(prisma as never, logger as never);
    const res = await svc.recordWeight('f1', 'u1', 'c1', {
      weightKg: 300,
      date: '2026-01-01',
    } as never);
    expect(prisma.cattle.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lastWeightKg: 480 },
    });
    expect(res.lastWeightKg).toBe(480);
  });

  it('a newest weight sets lastWeightKg to itself', async () => {
    const prisma = makePrisma({ weightKg: 500 }, null);
    const svc = new WeightService(prisma as never, logger as never);
    await svc.recordWeight('f1', 'u1', 'c1', { weightKg: 500 } as never);
    expect(prisma.cattle.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lastWeightKg: 500 },
    });
  });

  it('a past-dated BCS does not overwrite lastBcs when a newer record exists', async () => {
    const prisma = makePrisma(null, { score: 3.5 });
    const svc = new BcsService(prisma as never, logger as never);
    const res = await svc.recordBcs('f1', 'u1', 'c1', {
      score: 2,
      date: '2026-01-01',
    } as never);
    expect(prisma.cattle.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lastBcs: 3.5 },
    });
    expect(res.lastBcs).toBe(3.5);
  });
});
