import { FeedRequirementsService } from './feed-requirements.service';
import { DEFAULT_REQUIREMENT_SETTINGS } from '../../domain/requirement-settings';

/** RAKHAL-454 — `forCattle()` batched per-cow requirement + data-quality flags. */
describe('FeedRequirementsService.forCattle', () => {
  const DAY = 86_400_000;
  const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

  type CowRow = {
    id: string;
    lastWeightKg: number | null;
    lastBcs: number | null;
    productionStatus: string | null;
    gender: 'FEMALE';
    dateOfBirth: Date | null;
    reproductionProfile: {
      totalCalvings: number;
      lastCalvingDate: Date | null;
    } | null;
    lactations: {
      startDate: Date;
      isEstimated: boolean;
      estimatedDaysInMilk: number | null;
    }[];
  };
  const cow = (over: Partial<CowRow> & { id: string }): CowRow => ({
    lastWeightKg: 450,
    lastBcs: 3,
    productionStatus: 'MILKING',
    gender: 'FEMALE',
    dateOfBirth: daysAgo(365 * 4),
    reproductionProfile: { totalCalvings: 2, lastCalvingDate: daysAgo(120) },
    lactations: [
      {
        startDate: daysAgo(120),
        isEstimated: false,
        estimatedDaysInMilk: null,
      },
    ],
    ...over,
  });

  type Opts = {
    weighIns?: { cattleId: string; recordedDate: Date }[];
    yields?: Record<string, number>;
    pregnantDays?: Record<string, number>;
  };

  function build(cattle: CowRow[], opts: Opts = {}) {
    const prisma = {
      cattle: { findMany: jest.fn().mockResolvedValue(cattle) },
      weightRecord: {
        findMany: jest.fn().mockResolvedValue(opts.weighIns ?? []),
      },
      reproductionProfile: {
        findMany: jest.fn().mockResolvedValue(
          Object.keys(opts.pregnantDays ?? {}).map((cattleId) => ({
            cattleId,
            currentPregnancyId: `preg-${cattleId}`,
          })),
        ),
      },
      pregnancy: {
        findMany: jest.fn().mockResolvedValue(
          Object.entries(opts.pregnantDays ?? {}).map(([cattleId, d]) => ({
            id: `preg-${cattleId}`,
            conceptionDate: daysAgo(d),
          })),
        ),
      },
    };
    const milk = {
      averageDailyYield: jest
        .fn()
        .mockResolvedValue(new Map(Object.entries(opts.yields ?? {}))),
    };
    const settings = {
      resolve: jest.fn().mockResolvedValue(DEFAULT_REQUIREMENT_SETTINGS),
    };
    const service = new FeedRequirementsService(
      prisma as never,
      milk as never,
      settings as never,
      { resolveForCattle: jest.fn() } as never,
    );
    return { service, prisma, milk, settings };
  }

  const one = async (row: CowRow, opts: Opts = {}) => {
    const { service } = build([row], opts);
    const res = await service.forCattle('farm', [row.id]);
    return res.cows[0];
  };

  it('marks a female with no calvings as a HEIFER', async () => {
    const r = await one(
      cow({
        id: 'h',
        reproductionProfile: null,
        lactations: [],
        dateOfBirth: daysAgo(365 * 2),
      }),
    );
    expect(r.inputs.animal_type).toBe('HEIFER');
    expect(r.flags).not.toContain('milk_missing');
  });

  it('marks a DRY cow as DRY and does not flag missing milk', async () => {
    const r = await one(cow({ id: 'd', productionStatus: 'DRY' }));
    expect(r.inputs.animal_type).toBe('DRY');
    expect(r.flags).not.toContain('milk_missing');
  });

  it('flags a fresh calver with no milk records', async () => {
    const r = await one(
      cow({
        id: 'f',
        lactations: [
          {
            startDate: daysAgo(3),
            isEstimated: false,
            estimatedDaysInMilk: null,
          },
        ],
      }),
    );
    expect(r.flags).toContain('milk_missing');
    expect(r.inputs.milk_target_l).toBe(0);
    expect(r.inputs.dim).toBe(3);
  });

  it('flags a weight older than 60 days as weight_stale', async () => {
    const r = await one(cow({ id: 's' }), {
      weighIns: [{ cattleId: 's', recordedDate: daysAgo(90) }],
      yields: { s: 20 },
    });
    expect(r.flags).toContain('weight_stale');
    expect(r.flags).not.toContain('milk_missing');
  });

  it('uses the farm default weight and flags weight_estimated when unweighed', async () => {
    const r = await one(cow({ id: 'u', lastWeightKg: null, lastBcs: null }), {
      yields: { u: 15 },
    });
    expect(r.inputs.weight_kg).toBe(
      DEFAULT_REQUIREMENT_SETTINGS.defaultWeightKg,
    );
    expect(r.flags).toEqual(
      expect.arrayContaining(['weight_estimated', 'bcs_default']),
    );
  });

  it('feeds a live 250-day pregnancy into the requirement', async () => {
    const dry = await one(cow({ id: 'p', productionStatus: 'DRY' }));
    const preg = await one(cow({ id: 'p', productionStatus: 'DRY' }), {
      pregnantDays: { p: 250 },
    });
    expect(preg.inputs.gestation_days).toBe(250);
    expect(preg.requirements.me_mj).toBeGreaterThan(dry.requirements.me_mj);
  });

  it('a well-recorded milking cow has no flags', async () => {
    const r = await one(cow({ id: 'ok' }), {
      weighIns: [{ cattleId: 'ok', recordedDate: daysAgo(10) }],
      yields: { ok: 22 },
    });
    expect(r.flags).toEqual([]);
  });

  it('runs a fixed number of queries regardless of herd size, and reports unknown ids', async () => {
    const small = build([cow({ id: 'a' })]);
    await small.service.forCattle('farm', ['a']);
    const ids = Array.from({ length: 200 }, (_, i) => `c${i}`);
    const big = build(ids.map((id) => cow({ id })));
    const res = await big.service.forCattle('farm', [...ids, 'ghost']);
    const calls = (b: ReturnType<typeof build>) =>
      b.prisma.cattle.findMany.mock.calls.length +
      b.prisma.weightRecord.findMany.mock.calls.length +
      b.prisma.reproductionProfile.findMany.mock.calls.length +
      b.milk.averageDailyYield.mock.calls.length +
      b.settings.resolve.mock.calls.length;
    expect(calls(big)).toBe(calls(small));
    expect(res.cows).toHaveLength(200);
    expect(res.missing_cattle_ids).toEqual(['ghost']);
  });

  it('returns nothing for an empty id list without touching the database', async () => {
    const { service, prisma } = build([]);
    const res = await service.forCattle('farm', []);
    expect(res.cows).toEqual([]);
    expect(prisma.cattle.findMany).not.toHaveBeenCalled();
  });
});
