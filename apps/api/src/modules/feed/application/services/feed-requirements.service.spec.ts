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
    overrides?: OverrideRowFixture[];
  };
  type OverrideRowFixture = {
    id: string;
    cattleId: string;
    dmKg: number;
    cpKg: number;
    meMj: number;
    note: string | null;
    dynamicSnapshot: unknown;
    effectiveFrom: Date;
    setBy: string;
  };

  function build(cattle: CowRow[], opts: Opts = {}) {
    const prisma = {
      cattle: { findMany: jest.fn().mockResolvedValue(cattle) },
      weightRecord: {
        findMany: jest.fn().mockResolvedValue(opts.weighIns ?? []),
      },
      cattleRequirementOverride: {
        findMany: jest.fn().mockResolvedValue(opts.overrides ?? []),
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
      { resolveForCattle: jest.fn().mockResolvedValue(new Map()) } as never,
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
      b.prisma.cattleRequirementOverride.findMany.mock.calls.length +
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

describe('FeedRequirementsService — manual override (MILESTONE 28)', () => {
  const DAY = 86_400_000;
  const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
  const cowRow = (id: string) => ({
    id,
    lastWeightKg: 450,
    lastBcs: 3,
    productionStatus: 'MILKING',
    gender: 'FEMALE' as const,
    dateOfBirth: daysAgo(365 * 4),
    reproductionProfile: { totalCalvings: 2, lastCalvingDate: daysAgo(120) },
    lactations: [
      {
        startDate: daysAgo(120),
        isEstimated: false,
        estimatedDaysInMilk: null,
      },
    ],
  });
  const override = (
    cattleId: string,
    snap: { dm_kg: number; cp_kg: number; me_mj: number } = {
      dm_kg: 14,
      cp_kg: 1.7,
      me_mj: 120,
    },
  ) => ({
    id: `ov-${cattleId}`,
    cattleId,
    dmKg: 10,
    cpKg: 1.5,
    meMj: 100,
    note: 'dry-period figures',
    dynamicSnapshot: { ...snap, animal_type: 'COW' },
    effectiveFrom: daysAgo(1),
    setBy: 'user-1',
  });

  function build(cows: ReturnType<typeof cowRow>[], overrides: unknown[]) {
    const prisma = {
      cattle: { findMany: jest.fn().mockResolvedValue(cows) },
      weightRecord: { findMany: jest.fn().mockResolvedValue([]) },
      cattleRequirementOverride: {
        findMany: jest.fn().mockResolvedValue(overrides),
      },
      reproductionProfile: { findMany: jest.fn().mockResolvedValue([]) },
      pregnancy: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const milk = {
      averageDailyYield: jest.fn().mockResolvedValue(new Map()),
    };
    const settings = {
      resolve: jest.fn().mockResolvedValue(DEFAULT_REQUIREMENT_SETTINGS),
    };
    const service = new FeedRequirementsService(
      prisma as never,
      milk as never,
      settings as never,
      { resolveForCattle: jest.fn().mockResolvedValue(new Map()) } as never,
    );
    return { service, prisma };
  }

  it('a manual cow gets her manual DM/CP/ME, no flags, no Ca/P, and the calculated need beside it', async () => {
    const { service } = build([cowRow('m')], [override('m')]);
    const { cows } = await service.forCattle('farm', ['m']);
    const c = cows[0];
    expect(c.source).toBe('MANUAL');
    expect(c.flags).toEqual([]);
    expect(c.requirements).toMatchObject({
      dm_kg: 10,
      cp_kg: 1.5,
      me_mj: 100,
      calcium_kg: null,
      phosphorus_kg: null,
      breakdown: null,
    });
    expect(c.dynamic_requirements?.dm_kg).toBeDefined();
    expect(c.dynamic_requirements?.calcium_kg).not.toBeNull();
    expect(c.manual).toMatchObject({
      override_id: 'ov-m',
      note: 'dry-period figures',
    });
  });

  it('a cow with no override stays DYNAMIC and carries no manual block', async () => {
    const { service } = build([cowRow('d')], []);
    const c = (await service.forCattle('farm', ['d'])).cows[0];
    expect(c.source).toBe('DYNAMIC');
    expect(c).not.toHaveProperty('manual');
    expect(c).not.toHaveProperty('dynamic_requirements');
  });

  it('marks the override stale once the calculated need drifted past the setting', async () => {
    const dyn = build([cowRow('x')], []);
    const r = (await dyn.service.forCattle('farm', ['x'])).cows[0].requirements;
    const snap = { dm_kg: r.dm_kg, cp_kg: r.cp_kg, me_mj: r.me_mj };
    const fresh = build([cowRow('x')], [override('x', snap)]);
    const stale = build(
      [cowRow('x')],
      [override('x', { ...snap, dm_kg: snap.dm_kg / 2 })],
    );
    expect(
      (await fresh.service.forCattle('farm', ['x'])).cows[0].manual?.stale,
    ).toBe(false);
    expect(
      (await stale.service.forCattle('farm', ['x'])).cows[0].manual?.stale,
    ).toBe(true);
  });

  it('adds exactly one query for the override lookup, and a past date looks at the end of that day', async () => {
    const { service, prisma } = build([cowRow('a')], []);
    await service.forCattle('farm', ['a'], '2026-05-03');
    expect(prisma.cattleRequirementOverride.findMany).toHaveBeenCalledTimes(1);
    const call = prisma.cattleRequirementOverride.findMany.mock.calls[0] as [
      { where: { effectiveFrom: { lte: Date } } },
    ];
    expect(call[0].where.effectiveFrom.lte.toISOString()).toBe(
      '2026-05-04T00:00:00.000Z',
    );
  });

  it("the herd requirement sums each cow's resolved need, skipping a manual cow's Ca/P (RD-110)", async () => {
    const both = build([cowRow('m'), cowRow('d')], [override('m')]);
    const dynOnly = build([cowRow('d')], []);
    const res = await both.service.getTodaysRequirement('farm');
    const solo = await dynOnly.service.getTodaysRequirement('farm');
    const req = res.requirement;
    expect(req?.headcount).toBe(2);
    expect(req?.manual_headcount).toBe(1);
    expect(req?.ca_p_headcount).toBe(1);
    // herd DM = the manual cow's 10 + the calculated cow's DM
    expect(req?.herd_total.dm_kg).toBeCloseTo(
      10 + (solo.requirement?.herd_total.dm_kg as number),
      1,
    );
    expect(req?.herd_total.calcium_kg).toBe(
      solo.requirement?.herd_total.calcium_kg,
    );
  });
});
