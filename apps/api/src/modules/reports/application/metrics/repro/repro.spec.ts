import {
  aggregateServices,
  conceptionRate,
  MIN_DECIDED_FOR_CONCEPTION_RATE,
  REPEATED_FAILED_SERVICES_THRESHOLD,
  type ServiceRow,
} from './repro-aggregation';
import { Prisma } from '@prisma/client';
import { reproMetricModule } from './repro-metrics';
import { classifyBreedingStatus } from '../../../domain/eligibility';
import type { MetricContext } from '../metric-context';
import type { ReportPeriod } from '../../../domain/contracts/period';

const NOW = new Date('2026-10-20T00:00:00Z');
let n = 0;
const row = (over: Partial<ServiceRow> = {}): ServiceRow => ({
  cattleId: `c${++n}`,
  breedingMethod: 'AI',
  status: 'PENDING_CHECK',
  voidedAt: null,
  financeTransactionId: null,
  expectedPregnancyCheckDate: null,
  ...over,
});
const many = (k: number, over: Partial<ServiceRow>) =>
  Array.from({ length: k }, () => row(over));

describe('classification of every BreedingStatus', () => {
  it.each([
    ['PREGNANT', 'confirmed'],
    ['CALVED', 'confirmed'],
    ['PENDING_CHECK', 'pending'],
    ['FAILED', 'failed'],
    ['RETURNED_TO_HEAT', 'other'],
    ['ABORTED', 'other'],
    ['VOIDED', 'excluded'],
  ] as const)('%s -> %s', (s, c) => {
    expect(classifyBreedingStatus(s)).toBe(c);
  });
});

describe('aggregateServices', () => {
  it('pending is not failure and not in decided', () => {
    const a = aggregateServices(
      [...many(4, { status: 'PENDING_CHECK' }), row({ status: 'FAILED' })],
      NOW,
    );
    expect(a.pending).toBe(4);
    expect(a.failed).toBe(1);
    expect(a.decided).toBe(1);
  });

  it('excludes voided by timestamp and by status', () => {
    const a = aggregateServices(
      [
        row({ status: 'PREGNANT' }),
        row({ status: 'VOIDED' }),
        row({ status: 'FAILED', voidedAt: NOW }),
      ],
      NOW,
    );
    expect(a.total).toBe(1);
    expect(a.failed).toBe(0);
  });

  it('counts events and unique cows by method', () => {
    const a = aggregateServices(
      [
        row({ cattleId: 'x', breedingMethod: 'AI' }),
        row({ cattleId: 'x', breedingMethod: 'AI' }),
        row({ cattleId: 'y', breedingMethod: 'NATURAL' }),
        row({ cattleId: 'x', breedingMethod: 'EMBRYO_TRANSFER' }),
      ],
      NOW,
    );
    expect(a.total).toBe(4);
    expect(a.uniqueCows).toBe(2);
    expect(a.byMethod.AI).toEqual({ events: 2, uniqueCows: 1 });
    expect(a.byMethod.NATURAL.events).toBe(1);
    expect(a.byMethod.EMBRYO_TRANSFER.uniqueCows).toBe(1);
  });

  it('overdue only when expected date passed and still pending', () => {
    const a = aggregateServices(
      [
        row({ expectedPregnancyCheckDate: new Date('2026-10-19T00:00:00Z') }),
        row({ expectedPregnancyCheckDate: new Date('2026-10-21T00:00:00Z') }),
        row({ expectedPregnancyCheckDate: null }),
        row({
          status: 'PREGNANT',
          expectedPregnancyCheckDate: new Date('2026-10-01T00:00:00Z'),
        }),
      ],
      NOW,
    );
    expect(a.overdueChecks).toBe(1);
  });

  it('flags cows at the repeated-failure threshold only', () => {
    const rows = [
      ...many(REPEATED_FAILED_SERVICES_THRESHOLD, {
        cattleId: 'bad',
        status: 'FAILED',
      }),
      ...many(REPEATED_FAILED_SERVICES_THRESHOLD - 1, {
        cattleId: 'ok',
        status: 'FAILED',
      }),
    ];
    expect(aggregateServices(rows, NOW).cowsWithRepeatedFailures).toEqual([
      'bad',
    ]);
  });

  it('empty scope yields zeros', () => {
    const a = aggregateServices([], NOW);
    expect(a.total).toBe(0);
    expect(a.uniqueCows).toBe(0);
  });
});

describe('conceptionRate', () => {
  it('not_calculated with 0 decided', () => {
    expect(conceptionRate(0, 0).state).toBe('not_calculated');
  });
  it('not_calculated below minimum', () => {
    const v = conceptionRate(2, MIN_DECIDED_FOR_CONCEPTION_RATE - 3);
    expect(v.state).toBe('not_calculated');
  });
  it('value at minimum, other outcomes excluded by design', () => {
    expect(conceptionRate(3, 2)).toEqual({
      state: 'value',
      value: 60,
      unit: '%',
    });
  });
  it('100% and 0% are real values', () => {
    expect(conceptionRate(5, 0)).toMatchObject({ state: 'value', value: 100 });
    expect(conceptionRate(0, 5)).toMatchObject({ state: 'value', value: 0 });
  });
});

// ---- module with a fake db ----
const period = (start: string, end: string): ReportPeriod => ({
  start,
  end,
  startDate: start.slice(0, 10),
  endDate: end.slice(0, 10),
  timezone: 'UTC',
  label: 'p',
});
const P = period('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z');
const PREV = period('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z');

interface FakeWhere {
  cattle?: { farmId: string };
  cattleId: { in: string[] };
  voidedAt?: null;
  status?: string;
  breedingDate?: { gte: Date; lt: Date };
}

function fakeDb(
  events: (ServiceRow & { breedingDate: Date })[],
  historicalIds: string[] = [],
) {
  const breedingEvent = {
    findMany: jest.fn(({ where }: { where: FakeWhere }): Promise<unknown[]> => {
      return Promise.resolve(
        events.filter((e) => {
          if (!where.cattleId.in.includes(e.cattleId)) return false;
          if (where.voidedAt === null && e.voidedAt) return false;
          if (where.status && e.status !== where.status) return false;
          if (where.breedingDate) {
            if (e.breedingDate < where.breedingDate.gte) return false;
            if (e.breedingDate >= where.breedingDate.lt) return false;
          }
          return true;
        }),
      );
    }),
  };
  return {
    // RAKHAL-482: HISTORICAL headers (ids only).
    animalEvent: {
      findMany: jest
        .fn()
        .mockResolvedValue(historicalIds.map((id) => ({ id }))),
    },
    breedingEvent,
    calvingEvent: { findMany: jest.fn().mockResolvedValue([{ calfCount: 2 }]) },
    abortionEvent: { count: jest.fn().mockResolvedValue(1) },
    pregnancy: { count: jest.fn().mockResolvedValue(3) },
    expense: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { amount: new Prisma.Decimal('100.10') },
          { amount: new Prisma.Decimal('50.20') },
        ]),
    },
  };
}

function ctx(db: unknown, over: Partial<MetricContext> = {}): MetricContext {
  return {
    db: db as MetricContext['db'],
    farmId: 'f1',
    timezone: 'UTC',
    period: P,
    previousPeriod: null,
    cattleIds: ['a', 'b'],
    previousCattleIds: ['a', 'b'],
    generatedAt: NOW,
    thresholds: {} as MetricContext['thresholds'],
    includeFinance: false,
    scopeKind: 'ALL_ELIGIBLE',
    ...over,
  };
}
const ev = (
  cattleId: string,
  breedingDate: string,
  over: Partial<ServiceRow> = {},
) => ({ ...row({ cattleId, ...over }), breedingDate: new Date(breedingDate) });
const metric = (
  out: Awaited<ReturnType<typeof reproMetricModule.compute>>,
  name: string,
) => out.section?.metrics.find((m) => m.metricId === `reproduction.${name}`);

describe('reproMetricModule.compute', () => {
  it('groups by breeding date boundaries [start, end)', async () => {
    const db = fakeDb([
      ev('a', '2026-10-01T00:00:00Z', { status: 'PREGNANT' }), // in (start inclusive)
      ev('a', '2026-11-01T00:00:00Z', { status: 'PREGNANT' }), // out (end exclusive)
      ev('b', '2026-09-30T23:59:59Z', { status: 'FAILED' }), // out
    ]);
    const out = await reproMetricModule.compute(ctx(db));
    expect(metric(out, 'services_total')?.value).toMatchObject({ value: 1 });
    expect(metric(out, 'outcomes_confirmed')?.value).toMatchObject({
      value: 1,
    });
    expect(metric(out, 'outcomes_failed')?.value).toMatchObject({ value: 0 });
  });

  it('excludes voided and keeps pending out of the rate', async () => {
    const db = fakeDb([
      ev('a', '2026-10-05T00:00:00Z', { status: 'PREGNANT' }),
      ev('a', '2026-10-06T00:00:00Z', { status: 'FAILED', voidedAt: NOW }),
      ev('b', '2026-10-07T00:00:00Z', { status: 'PENDING_CHECK' }),
    ]);
    const out = await reproMetricModule.compute(ctx(db));
    expect(metric(out, 'services_total')?.value).toMatchObject({ value: 2 });
    expect(metric(out, 'outcomes_pending')?.value).toMatchObject({ value: 1 });
    expect(metric(out, 'outcomes_failed')?.value).toMatchObject({ value: 0 });
    expect(metric(out, 'conception_rate')?.value.state).toBe('not_calculated');
  });

  it('finance gate: absent and not fetched when includeFinance is false', async () => {
    const db = fakeDb([
      ev('a', '2026-10-05T00:00:00Z', { financeTransactionId: 'e1' }),
    ]);
    const out = await reproMetricModule.compute(ctx(db));
    expect(metric(out, 'ai_cost_total')).toBeUndefined();
    expect(db.expense.findMany).not.toHaveBeenCalled();
    expect(
      out.section?.metrics.every((m) => m.requiresPermission === null),
    ).toBe(true);
  });

  it('finance on: sums linked non-voided expenses and carries the permission', async () => {
    const db = fakeDb([
      ev('a', '2026-10-05T00:00:00Z', { financeTransactionId: 'e1' }),
    ]);
    const out = await reproMetricModule.compute(
      ctx(db, { includeFinance: true }),
    );
    const m = metric(out, 'ai_cost_total');
    expect(m?.value).toEqual({ state: 'value', value: 150.3, unit: 'BDT' });
    expect(m?.requiresPermission).toBe('finance.read');
    expect(db.expense.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1'] }, farmId: 'f1', voidedAt: null },
      select: { amount: true },
    });
  });

  it('finance on, services without cost link: missing, not zero', async () => {
    const db = fakeDb([ev('a', '2026-10-05T00:00:00Z')]);
    const out = await reproMetricModule.compute(
      ctx(db, { includeFinance: true }),
    );
    expect(metric(out, 'ai_cost_total')?.value.state).toBe('missing');
    expect(out.dataQuality.flags.hasUnknownCosts).toBe(true);
  });

  it('finance on, some AI without link: resolved sum plus partial note', async () => {
    const db = fakeDb([
      ev('a', '2026-10-05T00:00:00Z', { financeTransactionId: 'e1' }),
      ev('b', '2026-10-06T00:00:00Z'),
    ]);
    const out = await reproMetricModule.compute(
      ctx(db, { includeFinance: true }),
    );
    expect(metric(out, 'ai_cost_total')?.value.state).toBe('value');
    expect(out.dataQuality.notes).toContain('reports.dq.partial_costs');
  });

  it('every prisma call is farm-scoped, non-voided and period-bound', async () => {
    const db = fakeDb([ev('a', '2026-10-05T00:00:00Z')]);
    await reproMetricModule.compute(ctx(db, { includeFinance: true }));
    const scope = { cattleId: { in: ['a', 'b'] }, cattle: { farmId: 'f1' } };
    const range = {
      gte: new Date('2026-10-01T00:00:00Z'),
      lt: new Date('2026-11-01T00:00:00Z'),
    };
    const calls = (
      db.breedingEvent.findMany.mock.calls as [{ where: unknown }][]
    ).map((c) => c[0].where);
    expect(calls).toContainEqual({
      ...scope,
      voidedAt: null,
      breedingDate: range,
    });
    expect(calls).toContainEqual({
      ...scope,
      voidedAt: null,
      status: 'PENDING_CHECK',
    });
    expect(db.calvingEvent.findMany).toHaveBeenCalledWith({
      where: { ...scope, calvingDate: range },
      select: { calfCount: true },
    });
    expect(db.abortionEvent.count).toHaveBeenCalledWith({
      where: { ...scope, abortionDate: range },
    });
    const preg = (
      db.pregnancy.count.mock.calls as [{ where: unknown }][]
    )[0][0];
    expect(preg.where).toMatchObject({ ...scope, status: 'ACTIVE' });
  });

  it('leaves HISTORICAL events out of services, calvings and abortions (RAKHAL-482)', async () => {
    const db = fakeDb([ev('a', '2026-10-05T00:00:00Z')], ['h1', 'h2']);
    await reproMetricModule.compute(ctx(db, { includeFinance: true }));
    const clause = {
      OR: [{ animalEventId: null }, { animalEventId: { notIn: ['h1', 'h2'] } }],
    };
    for (const call of db.breedingEvent.findMany.mock.calls as [
      { where: unknown },
    ][]) {
      expect(call[0].where).toMatchObject(clause);
    }
    expect(
      (db.calvingEvent.findMany.mock.calls as [{ where: unknown }][])[0][0]
        .where,
    ).toMatchObject(clause);
    expect(
      (db.abortionEvent.count.mock.calls as [{ where: unknown }][])[0][0].where,
    ).toMatchObject(clause);
  });

  it('adds no clause when the farm has no HISTORICAL events', async () => {
    const db = fakeDb([ev('a', '2026-10-05T00:00:00Z')]);
    await reproMetricModule.compute(ctx(db, { includeFinance: true }));
    for (const call of db.breedingEvent.findMany.mock.calls as [
      { where: Record<string, unknown> },
    ][]) {
      expect(call[0].where).not.toHaveProperty('OR');
    }
  });

  it('empty scope: zero counts, no queries, scopeEmpty note', async () => {
    const db = fakeDb([]);
    const out = await reproMetricModule.compute(
      ctx(db, { cattleIds: [], previousCattleIds: [] }),
    );
    expect(db.breedingEvent.findMany).not.toHaveBeenCalled();
    expect(metric(out, 'services_total')?.value).toMatchObject({ value: 0 });
    expect(metric(out, 'conception_rate')?.value.state).toBe('not_calculated');
    expect(out.dataQuality.notes).toContain('reports.dq.scope_empty');
  });

  it('previous period zero: percentChange null, absolute change kept', async () => {
    const db = fakeDb([ev('a', '2026-10-05T00:00:00Z')]);
    const out = await reproMetricModule.compute(
      ctx(db, { previousPeriod: PREV }),
    );
    const c = metric(out, 'services_total')?.comparison;
    expect(c?.absoluteChange).toBe(1);
    expect(c?.percentChange).toBeNull();
  });

  it('no previous period: no comparison', async () => {
    const out = await reproMetricModule.compute(ctx(fakeDb([])));
    expect(metric(out, 'services_total')?.comparison).toBeNull();
  });

  it('overdue pending raises an exception regardless of breeding date', async () => {
    const db = fakeDb([
      ev('a', '2026-05-01T00:00:00Z', {
        expectedPregnancyCheckDate: new Date('2026-06-01T00:00:00Z'),
      }),
    ]);
    const out = await reproMetricModule.compute(ctx(db));
    expect(metric(out, 'pregnancy_checks_overdue')?.value).toMatchObject({
      value: 1,
    });
    expect(out.exceptions.map((e) => e.code)).toContain(
      'reproduction.pregnancy_check_overdue',
    );
  });

  it('every definition has calcVersion 1 and only cost is finance-gated', () => {
    expect(
      reproMetricModule.definitions.every((d) => d.calcVersion === 1),
    ).toBe(true);
    const gated = reproMetricModule.definitions.filter(
      (d) => d.requiresPermission,
    );
    expect(gated.map((d) => d.id)).toEqual(['reproduction.ai_cost_total']);
  });
});
