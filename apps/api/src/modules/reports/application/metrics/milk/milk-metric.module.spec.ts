import type { ReportPeriod } from '../../../domain/contracts/period';
import type { MetricContext } from '../metric-context';
import { aggregateMilk } from './milk-aggregation';
import { buildMilkOutput, milkMetricModule } from './milk-metric.module';

const period = (startDate: string, endDate: string): ReportPeriod => ({
  start: `${startDate}T00:00:00.000Z`,
  end: `${endDate}T23:59:59.999Z`,
  startDate,
  endDate,
  timezone: 'Asia/Dhaka',
  label: 'test',
});

interface Where {
  cattleId: { in: string[] };
  logDate: { gte: Date; lte: Date };
  submitted: boolean;
  farmId: string;
}
type Fixture = {
  cattleId: string;
  ymd: string;
  session?: string;
  yieldL: number;
  submitted?: boolean;
  disposition?: string;
};

function mockDb(
  fixtures: Fixture[],
  sessions: string[] | null = ['morning', 'evening'],
) {
  const matches = (f: Fixture, w: Where) => {
    const d = new Date(`${f.ymd}T00:00:00.000Z`).getTime();
    return (
      w.cattleId.in.includes(f.cattleId) &&
      d >= w.logDate.gte.getTime() &&
      d <= w.logDate.lte.getTime() &&
      (f.submitted ?? true) === w.submitted
    );
  };
  const findMany = jest.fn(({ where }: { where: Where }) =>
    Promise.resolve(
      fixtures
        .filter((f) => matches(f, where))
        .map((f) => ({
          cattleId: f.cattleId,
          logDate: new Date(`${f.ymd}T00:00:00.000Z`),
          session: f.session ?? 'MORNING',
          yieldL: f.yieldL,
          disposition: f.disposition ?? 'SALEABLE',
          submitted: f.submitted ?? true,
        })),
    ),
  );
  const count = jest.fn(({ where }: { where: Where }) =>
    Promise.resolve(fixtures.filter((f) => matches(f, where)).length),
  );
  const findUnique = jest.fn(() =>
    Promise.resolve(sessions ? { milkActiveSessions: sessions } : null),
  );
  return {
    db: {
      milkLogEntry: { findMany, count },
      farmModuleSettings: { findUnique },
    },
    findMany,
    count,
    findUnique,
  };
}

const ctxOf = (
  db: unknown,
  over: Partial<MetricContext> = {},
): MetricContext => ({
  db: db as MetricContext['db'],
  farmId: 'farm-1',
  timezone: 'Asia/Dhaka',
  period: period('2026-10-05', '2026-10-11'),
  previousPeriod: period('2026-09-28', '2026-10-04'),
  scopeKind: 'ALL_ELIGIBLE',
  cattleIds: ['a', 'b'],
  previousCattleIds: ['a', 'b'],
  generatedAt: new Date('2026-10-12T03:00:00.000Z'),
  thresholds: {
    suddenDropPct: 30,
    repeatedCaseWindowDays: 60,
    finalizationMaxWaitHours: 12,
  },
  includeFinance: false,
  ...over,
});

type Out = Awaited<ReturnType<typeof milkMetricModule.compute>>;
const find = (out: Out, id: string) =>
  out.section?.metrics.find((m) => m.metricId === id);
const point = (out: Out, id: string, key: string) =>
  find(out, id)?.series?.find((p) => p.key === key);
const rowOf = (out: Out, id: string, key: string) =>
  find(out, id)?.rows?.find((r) => r.key === key);

describe('milkMetricModule', () => {
  it('declares a v1 definition for every emitted metric id, all milk.*', () => {
    expect(milkMetricModule.definitions.length).toBeGreaterThan(8);
    for (const d of milkMetricModule.definitions) {
      expect(d.id.startsWith('milk.')).toBe(true);
      expect(d.calcVersion).toBe(1);
      expect(d.formula && d.eligibilityRule && d.missingDataRule).toBeTruthy();
    }
  });

  it('emits one result per concept and never encodes keys in source', async () => {
    const { db } = mockDb([{ cattleId: 'a', ymd: '2026-10-05', yieldL: 3 }]);
    const out = await milkMetricModule.compute(ctxOf(db));
    const ids = out.section?.metrics.map((m) => m.metricId) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(out.section?.metrics.every((m) => m.source === null)).toBe(true);
    expect(find(out, 'milk.daily_yield')?.series).toHaveLength(7);
    expect(rowOf(out, 'milk.cow_total_yield', 'b')?.value.state).toBe(
      'missing',
    );
  });

  it('uses cattlePresence for expected cow-days and clamps to generation', async () => {
    const { db } = mockDb([{ cattleId: 'a', ymd: '2026-10-05', yieldL: 3 }]);
    const out = await milkMetricModule.compute(
      ctxOf(db, {
        previousPeriod: null,
        generatedAt: new Date('2026-10-09T10:00:00.000Z'), // days 05..09
        cattlePresence: new Map([
          ['a', { startDate: '2026-10-03', endDate: '2026-10-07' }], // 05,06,07
          ['b', { startDate: '2026-10-08', endDate: '2026-10-20' }], // 08,09
        ]),
      }),
    );
    expect(out.dataQuality.coverage).toEqual({ expected: 5, recorded: 1 });
    expect(rowOf(out, 'milk.cow_expected_days', 'a')?.value).toMatchObject({
      value: 3,
    });
    expect(rowOf(out, 'milk.cow_expected_days', 'b')?.value).toMatchObject({
      value: 2,
    });
    expect(out.dataQuality.flags.hasEstimatedValues).toBe(false);
  });

  it('flags estimated values when presence is unavailable', async () => {
    const { db } = mockDb([]);
    const out = await milkMetricModule.compute(ctxOf(db));
    expect(out.dataQuality.flags.hasEstimatedValues).toBe(true);
    expect(out.dataQuality.notes).toContain('reports.dq.estimated_values');
  });

  it('computes totals, trend vs previous period, coverage and drafts flag', async () => {
    const { db, findMany, count } = mockDb([
      { cattleId: 'a', ymd: '2026-10-05', yieldL: 10 },
      { cattleId: 'a', ymd: '2026-10-11', yieldL: 20 },
      { cattleId: 'b', ymd: '2026-10-06', yieldL: 0 },
      { cattleId: 'a', ymd: '2026-10-07', yieldL: 99, submitted: false },
      { cattleId: 'a', ymd: '2026-10-01', yieldL: 15 },
    ]);
    const out = await milkMetricModule.compute(ctxOf(db));

    expect(find(out, 'milk.total_yield')?.value).toEqual({
      state: 'value',
      value: 30,
      unit: 'L',
    });
    const cmp = find(out, 'milk.total_yield')?.comparison;
    expect(cmp?.previous).toEqual({ state: 'value', value: 15, unit: 'L' });
    expect(cmp?.absoluteChange).toBe(15);
    expect(cmp?.percentChange).toBe(100);
    expect(find(out, 'milk.cows_with_data')?.value).toMatchObject({ value: 2 });
    expect(point(out, 'milk.daily_yield', '2026-10-06')?.value).toMatchObject({
      state: 'value',
      value: 0,
    });
    expect(point(out, 'milk.daily_yield', '2026-10-08')?.value.state).toBe(
      'missing',
    );
    expect(out.dataQuality.coverage).toEqual({ expected: 14, recorded: 3 });
    expect(out.dataQuality.flags.hasUnsubmittedDrafts).toBe(true);
    expect(out.dataQuality.flags.incompleteCoverage).toBe(true);
    expect(out.exceptions).toEqual([]);
    // every fetch is farm-scoped and submitted-only
    for (const [arg] of findMany.mock.calls as [{ where: Where }][]) {
      expect(arg.where.farmId).toBe('farm-1');
      expect(arg.where.submitted).toBe(true);
    }
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('issues exactly the expected Prisma where-shapes', async () => {
    const { db, findMany, count, findUnique } = mockDb([
      { cattleId: 'a', ymd: '2026-10-05', yieldL: 1 },
    ]);
    await milkMetricModule.compute(ctxOf(db));
    const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
    const ids = { in: ['a', 'b'] };
    // current period (reaches back 7 days before the last day for the drop baseline) + previous
    expect(findMany).toHaveBeenCalledTimes(2);
    const wheres = findMany.mock.calls.map(
      ([arg]) => (arg as { where: unknown }).where,
    );
    expect(wheres).toContainEqual({
      farmId: 'farm-1',
      cattleId: ids,
      logDate: { gte: d('2026-10-04'), lte: d('2026-10-11') },
      submitted: true,
    });
    expect(wheres).toContainEqual({
      farmId: 'farm-1',
      cattleId: ids,
      logDate: { gte: d('2026-09-28'), lte: d('2026-10-04') },
      submitted: true,
    });
    // drafts: period bounds only, submitted:false
    expect(count).toHaveBeenCalledWith({
      where: {
        farmId: 'farm-1',
        cattleId: ids,
        logDate: { gte: d('2026-10-05'), lte: d('2026-10-11') },
        submitted: false,
      },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { farmId: 'farm-1' },
      select: { milkActiveSessions: true },
    });
    // none of the milk queries filter on deletedAt (MilkLogEntry has no soft delete)
    for (const w of wheres) expect(w).not.toHaveProperty('deletedAt');
  });

  it('unknown expected days for a cow is missing with a reason, never 0', () => {
    const agg = aggregateMilk({
      rows: [],
      cattleIds: ['a'],
      days: ['2026-10-05'],
    });
    const out = buildMilkOutput({
      current: { ...agg, expectedDaysByCow: {} },
      previous: null,
      currentRows: [],
      draftCount: 0,
      expectedSessions: [],
      ctx: {
        cattleIds: ['a'],
        thresholds: ctxOf(null).thresholds,
      },
    });
    expect(rowOf(out, 'milk.cow_expected_days', 'a')?.value).toEqual({
      state: 'missing',
      reason: 'reports.milk.expected_days_unknown',
    });
  });

  it('zero previous: percentChange is null, no Infinity', async () => {
    const { db } = mockDb([
      { cattleId: 'a', ymd: '2026-10-05', yieldL: 10 },
      { cattleId: 'a', ymd: '2026-10-01', yieldL: 0 },
    ]);
    const out = await milkMetricModule.compute(ctxOf(db));
    const cmp = find(out, 'milk.total_yield')?.comparison;
    expect(cmp?.previous).toMatchObject({ state: 'value', value: 0 });
    expect(cmp?.percentChange).toBeNull();
  });

  it('previous period with no rows: previous missing, no percent', async () => {
    const { db } = mockDb([{ cattleId: 'a', ymd: '2026-10-05', yieldL: 10 }]);
    const out = await milkMetricModule.compute(ctxOf(db));
    const cmp = find(out, 'milk.total_yield')?.comparison;
    expect(cmp?.previousState).toBe('missing');
    expect(cmp?.percentChange).toBeNull();
  });

  it('no previous period: no comparison', async () => {
    const { db } = mockDb([{ cattleId: 'a', ymd: '2026-10-05', yieldL: 10 }]);
    const out = await milkMetricModule.compute(
      ctxOf(db, { previousPeriod: null }),
    );
    expect(find(out, 'milk.total_yield')?.comparison).toBeNull();
  });

  it('no data at all: total is missing with a reason, avg missing, not 0', async () => {
    const { db } = mockDb([]);
    const out = await milkMetricModule.compute(ctxOf(db));
    const total = find(out, 'milk.total_yield')?.value;
    expect(total?.state).toBe('missing');
    expect(total).toHaveProperty('reason');
    expect(find(out, 'milk.avg_daily_yield')?.value.state).toBe('missing');
    expect(rowOf(out, 'milk.cow_total_yield', 'a')?.value.state).toBe(
      'missing',
    );
    expect(find(out, 'milk.sudden_drop_cows')?.value.state).toBe(
      'not_calculated',
    );
    expect(out.dataQuality.coverage).toEqual({ expected: 14, recorded: 0 });
  });

  it('no cows: not_applicable, no queries issued, nothing thrown', async () => {
    const { db, findMany, count } = mockDb([]);
    const out = await milkMetricModule.compute(
      ctxOf(db, { cattleIds: [], previousCattleIds: [] }),
    );
    expect(find(out, 'milk.total_yield')?.value.state).toBe('not_applicable');
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
    expect(out.dataQuality.notes).toContain('reports.dq.scope_empty');
  });

  it('single cow with data ranks top and has per-cow recorded/expected days', async () => {
    const { db } = mockDb([
      { cattleId: 'a', ymd: '2026-10-05', yieldL: 10 },
      { cattleId: 'a', ymd: '2026-10-06', yieldL: 14 },
    ]);
    const out = await milkMetricModule.compute(ctxOf(db, { cattleIds: ['a'] }));
    expect(rowOf(out, 'milk.top_cow_avg_yield', 'a')?.value).toMatchObject({
      value: 12,
    });
    expect(rowOf(out, 'milk.cow_recorded_days', 'a')?.value).toMatchObject({
      value: 2,
    });
    expect(rowOf(out, 'milk.cow_expected_days', 'a')?.value).toMatchObject({
      value: 7,
    });
    expect(find(out, 'milk.bottom_cow_avg_yield')?.rows).toEqual([]);
    expect(find(out, 'milk.bottom_cow_avg_yield')?.value.state).toBe('missing');
  });

  it('future days of a running period are not expected', async () => {
    const { db } = mockDb([{ cattleId: 'a', ymd: '2026-10-05', yieldL: 5 }]);
    const out = await milkMetricModule.compute(
      ctxOf(db, {
        cattleIds: ['a'],
        previousPeriod: null,
        generatedAt: new Date('2026-10-07T10:00:00.000Z'),
      }),
    );
    expect(out.dataQuality.coverage).toEqual({ expected: 3, recorded: 1 });
  });

  it('raises a grouped sudden-drop exception only with complete data', async () => {
    const fx: Fixture[] = [];
    for (let d = 4; d <= 10; d++) {
      const ymd = `2026-10-${String(d).padStart(2, '0')}`;
      fx.push(
        { cattleId: 'a', ymd, session: 'MORNING', yieldL: 10 },
        { cattleId: 'a', ymd, session: 'EVENING', yieldL: 10 },
      );
    }
    fx.push(
      { cattleId: 'a', ymd: '2026-10-11', session: 'MORNING', yieldL: 5 },
      { cattleId: 'a', ymd: '2026-10-11', session: 'EVENING', yieldL: 5 },
    );
    const out = await milkMetricModule.compute(
      ctxOf(mockDb(fx).db, { cattleIds: ['a'] }),
    );
    expect(out.exceptions).toEqual([
      expect.objectContaining({ code: 'milk.sudden_drop', cattleIds: ['a'] }),
    ]);
    expect(find(out, 'milk.sudden_drop_cows')?.value).toMatchObject({
      value: 1,
    });

    // same decline but the evaluated day has only one session: no exception
    const partial = fx.filter(
      (f) => !(f.ymd === '2026-10-11' && f.session === 'EVENING'),
    );
    const out2 = await milkMetricModule.compute(
      ctxOf(mockDb(partial).db, { cattleIds: ['a'] }),
    );
    expect(out2.exceptions).toEqual([]);
    expect(find(out2, 'milk.sudden_drop_cows')?.value.state).toBe(
      'not_calculated',
    );
  });

  it('missing settings row falls back to morning+evening sessions', async () => {
    const { db, findUnique } = mockDb(
      [{ cattleId: 'a', ymd: '2026-10-05', yieldL: 1 }],
      null,
    );
    await milkMetricModule.compute(ctxOf(db, { cattleIds: ['a'] }));
    expect(findUnique).toHaveBeenCalled();
  });

  it('reports disposition totals as informational, sorted', async () => {
    const { db } = mockDb([
      { cattleId: 'a', ymd: '2026-10-05', yieldL: 10, disposition: 'WITHHELD' },
      { cattleId: 'a', ymd: '2026-10-06', yieldL: 5, disposition: 'SALEABLE' },
    ]);
    const out = await milkMetricModule.compute(ctxOf(db, { cattleIds: ['a'] }));
    expect(
      rowOf(out, 'milk.disposition_yield', 'SALEABLE')?.value,
    ).toMatchObject({
      value: 5,
    });
    expect(
      rowOf(out, 'milk.disposition_yield', 'WITHHELD')?.value,
    ).toMatchObject({
      value: 10,
    });
    expect(find(out, 'milk.total_yield')?.value).toMatchObject({ value: 15 });
  });
});
