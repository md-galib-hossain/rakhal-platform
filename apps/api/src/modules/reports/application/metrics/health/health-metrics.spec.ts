import type { MetricContext } from '../metric-context';
import { healthMetricModule } from './index';

const period = (start: string, end: string, label: string) => ({
  start: `${start}T00:00:00.000Z`,
  end: `${end}T00:00:00.000Z`,
  startDate: start,
  endDate: end,
  timezone: 'UTC',
  label,
});

function makeDb(over: Record<string, jest.Mock> = {}) {
  const empty = () => jest.fn().mockResolvedValue([]);
  return {
    healthCase: { findMany: empty() },
    treatmentLog: { findMany: empty() },
    healthTask: { findMany: empty() },
    safetyWithdrawal: { findMany: empty() },
    expense: { findMany: empty() },
    ...Object.fromEntries(
      Object.entries(over).map(([k, v]) => [k, { findMany: v }]),
    ),
  };
}

function ctx(db: unknown, o: Partial<MetricContext> = {}): MetricContext {
  return {
    db: db as MetricContext['db'],
    farmId: 'f1',
    scopeKind: 'ALL_ELIGIBLE',
    timezone: 'UTC',
    period: period('2026-10-01', '2026-11-01', 'October 2026'),
    previousPeriod: null,
    cattleIds: ['c1', 'c2'],
    previousCattleIds: ['c1', 'c2'],
    generatedAt: new Date('2026-11-02T00:00:00Z'),
    thresholds: {
      suddenDropPct: 30,
      repeatedCaseWindowDays: 60,
      finalizationMaxWaitHours: 24,
    },
    includeFinance: false,
    ...o,
  };
}

const get = (
  out: Awaited<ReturnType<typeof healthMetricModule.compute>>,
  id: string,
) => out.section!.metrics.find((m) => m.metricId === id);

describe('healthMetricModule.compute', () => {
  it('empty scope -> not_applicable everywhere, no queries', async () => {
    const db = makeDb();
    const out = await healthMetricModule.compute(
      ctx(db, { cattleIds: [], includeFinance: true }),
    );
    expect(out.section!.metrics.length).toBeGreaterThan(0);
    for (const m of out.section!.metrics)
      expect(m.value).toEqual({ state: 'not_applicable' });
    expect(db.healthCase.findMany).not.toHaveBeenCalled();
    expect(out.dataQuality.notes).toContain('reports.dq.scope_empty');
  });

  it('zero cases with cows in scope is an explicit value 0', async () => {
    const out = await healthMetricModule.compute(ctx(makeDb()));
    expect(get(out, 'health.cases_opened')?.value).toEqual({
      state: 'value',
      value: 0,
      unit: 'cases',
    });
  });

  it('events vs unique cows; voided filter and farm/cattle/deletedAt scoping in queries', async () => {
    const cases = [
      {
        id: 'a',
        cattleId: 'c1',
        condition: 'MASTITIS',
        status: 'ACTIVE',
        startDate: new Date('2026-10-05'),
        closedDate: null,
      },
      {
        id: 'b',
        cattleId: 'c1',
        condition: 'LAMENESS',
        status: 'ACTIVE',
        startDate: new Date('2026-10-06'),
        closedDate: null,
      },
    ];
    const logs = [
      { id: 't1', cattleId: 'c1', financeTransactionId: null },
      { id: 't2', cattleId: 'c1', financeTransactionId: null },
    ];
    const db = makeDb({
      healthCase: jest.fn().mockResolvedValue(cases),
      treatmentLog: jest.fn().mockResolvedValue(logs),
    });
    const out = await healthMetricModule.compute(ctx(db));
    expect(
      (get(out, 'health.cases_opened')!.value as { value: number }).value,
    ).toBe(2);
    expect(
      (get(out, 'health.cows_with_cases_opened')!.value as { value: number })
        .value,
    ).toBe(1);
    expect(
      (get(out, 'health.treatments_given')!.value as { value: number }).value,
    ).toBe(2);
    expect(
      (get(out, 'health.cows_treated')!.value as { value: number }).value,
    ).toBe(1);
    const caseWhere = whereOf(db.healthCase.findMany);
    expect(caseWhere).toMatchObject({
      farmId: 'f1',
      deletedAt: null,
      careType: 'CURATIVE',
      cattleId: { in: ['c1', 'c2'] },
    });
    const logWhere = whereOf(db.treatmentLog.findMany);
    expect(logWhere).toMatchObject({
      farmId: 'f1',
      voidedAt: null,
      cattleId: { in: ['c1', 'c2'] },
      administeredAt: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lt: new Date('2026-11-01T00:00:00.000Z'),
      },
      healthCase: { deletedAt: null },
    });
    expect(caseWhere).toMatchObject({
      startDate: { lt: new Date('2026-11-01T00:00:00.000Z') },
    });
    const taskWhere = whereOf(db.healthTask.findMany);
    expect(taskWhere).toMatchObject({
      farmId: 'f1',
      deletedAt: null,
      cattleId: { in: ['c1', 'c2'] },
    });
    expect(whereOf(db.safetyWithdrawal.findMany)).toMatchObject({
      farmId: 'f1',
      cattleId: { in: ['c1', 'c2'] },
      healthCase: { deletedAt: null },
    });
  });

  it('finance gate: includeFinance false => cost metric absent and expense never queried', async () => {
    const db = makeDb({
      treatmentLog: jest
        .fn()
        .mockResolvedValue([
          { id: 't', cattleId: 'c1', financeTransactionId: 'e1' },
        ]),
    });
    const out = await healthMetricModule.compute(
      ctx(db, { includeFinance: false }),
    );
    expect(get(out, 'health.treatment_cost')).toBeUndefined();
    expect(get(out, 'health.vet_fees')).toBeUndefined();
    expect(
      out.section!.metrics.some((m) => m.requiresPermission === 'finance.read'),
    ).toBe(false);
    expect(db.expense.findMany).not.toHaveBeenCalled();
    expect(out.dataQuality.flags.hasUnknownCosts).toBe(false);
  });

  it('finance on: cost summed from non-voided expenses, requiresPermission set', async () => {
    const db = makeDb({
      treatmentLog: jest
        .fn()
        .mockResolvedValue([
          { id: 't', cattleId: 'c1', financeTransactionId: 'e1' },
        ]),
      expense: jest.fn().mockResolvedValue([{ id: 'e1', amount: '250.00' }]),
    });
    const out = await healthMetricModule.compute(
      ctx(db, { includeFinance: true }),
    );
    const m = get(out, 'health.treatment_cost')!;
    expect(m.value).toEqual({ state: 'value', value: 250, unit: 'BDT' });
    expect(m.requiresPermission).toBe('finance.read');
    expect(whereOf(db.expense.findMany)).toMatchObject({
      farmId: 'f1',
      voidedAt: null,
      id: { in: ['e1'] },
    });
  });

  const costLog = (id: string, ftx: string | null) => ({
    id,
    cattleId: 'c1',
    financeTransactionId: ftx,
  });
  const costOf = async (logs: unknown[], expenses: unknown[]) => {
    const db = makeDb({
      treatmentLog: jest.fn().mockResolvedValue(logs),
      expense: jest.fn().mockResolvedValue(expenses),
    });
    const out = await healthMetricModule.compute(
      ctx(db, { includeFinance: true }),
    );
    return { out, m: get(out, 'health.treatment_cost')! };
  };

  it('cost: treatments but only voided/absent expenses => missing, not 0', async () => {
    const { out, m } = await costOf([costLog('t1', 'e1')], []);
    expect(m.value.state).toBe('missing');
    expect(out.dataQuality.flags.hasUnknownCosts).toBe(true);
  });

  it('cost: treatments with no financeTransactionId => missing', async () => {
    const { m, out } = await costOf([costLog('t1', null)], []);
    expect(m.value.state).toBe('missing');
    expect(out.dataQuality.flags.hasUnknownCosts).toBe(true);
  });

  it('cost: partial resolution => resolvable sum + partial_costs note + unknown flag', async () => {
    const { m, out } = await costOf(
      [costLog('t1', 'e1'), costLog('t2', 'e2'), costLog('t3', null)],
      [{ id: 'e1', amount: '100.10' }],
    );
    expect(m.value).toEqual({ state: 'value', value: 100.1, unit: 'BDT' });
    expect(out.dataQuality.notes).toContain('reports.dq.partial_costs');
    expect(out.dataQuality.flags.hasUnknownCosts).toBe(true);
  });

  it('cost: all resolved => no partial note; no treatments => genuine 0', async () => {
    const full = await costOf(
      [costLog('t1', 'e1'), costLog('t2', 'e2')],
      [
        { id: 'e1', amount: '0.10' },
        { id: 'e2', amount: '0.20' },
      ],
    );
    expect(full.m.value).toEqual({ state: 'value', value: 0.3, unit: 'BDT' });
    expect(full.out.dataQuality.notes).not.toContain(
      'reports.dq.partial_costs',
    );
    expect(full.out.dataQuality.flags.hasUnknownCosts).toBe(false);
    const none = await costOf([], []);
    expect(none.m.value).toEqual({ state: 'value', value: 0, unit: 'BDT' });
  });

  it('vet fees: unresolved vet expense => missing; partial => value + note', async () => {
    const vet = (id: string, veId: string | null) => ({
      id,
      cattleId: 'c1',
      financeTransactionId: null,
      vetCost: '40.00',
      vetExpenseId: veId,
    });
    const run = async (logs: unknown[], expenses: unknown[]) => {
      const db = makeDb({
        treatmentLog: jest.fn().mockResolvedValue(logs),
        expense: jest.fn().mockResolvedValue(expenses),
      });
      return healthMetricModule.compute(ctx(db, { includeFinance: true }));
    };
    const miss = await run([vet('t1', 'v1')], []);
    expect(get(miss, 'health.vet_fees')!.value.state).toBe('missing');
    const part = await run(
      [vet('t1', 'v1'), vet('t2', null)],
      [{ id: 'v1', amount: '40.00' }],
    );
    expect(get(part, 'health.vet_fees')!.value).toEqual({
      state: 'value',
      value: 40,
      unit: 'BDT',
    });
    expect(part.dataQuality.notes).toContain('reports.dq.partial_costs');
  });

  it('vet fees: separate finance-gated metric, source vet_fee, not merged into treatment_cost', async () => {
    const db = makeDb({
      treatmentLog: jest.fn().mockResolvedValue([
        {
          id: 't1',
          cattleId: 'c1',
          financeTransactionId: 'e1',
          vetCost: '300.00',
          vetExpenseId: 'v1',
        },
        {
          id: 't2',
          cattleId: 'c2',
          financeTransactionId: 'e2',
          vetCost: '50.00',
          vetExpenseId: 'e2', // same Expense as treatment cost: skipped
        },
      ]),
      expense: jest.fn().mockResolvedValue([
        { id: 'e1', amount: '250.00' },
        { id: 'e2', amount: '50.00' },
        { id: 'v1', amount: '300.00' },
      ]),
    });
    const out = await healthMetricModule.compute(
      ctx(db, { includeFinance: true }),
    );
    const v = get(out, 'health.vet_fees')!;
    expect(v.value).toEqual({ state: 'value', value: 300, unit: 'BDT' });
    expect(v.source).toBe('vet_fee');
    expect(v.requiresPermission).toBe('finance.read');
    expect(get(out, 'health.treatment_cost')!.value).toEqual({
      state: 'value',
      value: 300,
      unit: 'BDT',
    });
  });

  it('active withdrawals query includes READY_FOR_RELEASE', async () => {
    const db = makeDb({
      safetyWithdrawal: jest.fn().mockResolvedValue([
        { id: 'w1', cattleId: 'c1', status: 'ACTIVE' },
        { id: 'w2', cattleId: 'c2', status: 'READY_FOR_RELEASE' },
      ]),
    });
    const out = await healthMetricModule.compute(ctx(db));
    expect(
      (get(out, 'health.withdrawals_active')!.value as { value: number }).value,
    ).toBe(2);
    expect(whereOf(db.safetyWithdrawal.findMany)).toMatchObject({
      status: { in: ['ACTIVE', 'READY_FOR_RELEASE'] },
    });
  });

  it('overdue is derived from dueDateTime and listed as an exception', async () => {
    const db = makeDb({
      healthTask: jest.fn().mockResolvedValue([
        {
          id: 'k',
          cattleId: 'c2',
          planEnrollmentId: null,
          status: 'PENDING',
          dueDateTime: new Date('2026-10-30'),
          completedAt: null,
        },
      ]),
    });
    const out = await healthMetricModule.compute(ctx(db));
    expect(
      (get(out, 'health.tasks_overdue')!.value as { value: number }).value,
    ).toBe(1);
    expect(
      out.exceptions.find((e) => e.code === 'health.overdue_tasks')?.cattleIds,
    ).toEqual(['c2']);
  });

  it('previous period zero: comparison present with null percent; no previous cows => not_applicable', async () => {
    const withPrev = ctx(makeDb(), {
      previousPeriod: period('2026-09-01', '2026-10-01', 'Sep'),
    });
    const a = await healthMetricModule.compute(withPrev);
    const cmp = get(a, 'health.cases_opened')!.comparison!;
    expect(cmp.previous).toEqual({ state: 'value', value: 0, unit: 'cases' });
    expect(cmp.percentChange).toBeNull();

    const noPrevCows = ctx(makeDb(), {
      previousPeriod: period('2026-09-01', '2026-10-01', 'Sep'),
      previousCattleIds: [],
    });
    const b = await healthMetricModule.compute(noPrevCows);
    expect(get(b, 'health.cases_opened')!.comparison!.previousState).toBe(
      'not_applicable',
    );
  });

  it('every output metric id has a definition with calcVersion 1', () => {
    const ids = new Set(healthMetricModule.definitions.map((d) => d.id));
    expect(ids.size).toBe(healthMetricModule.definitions.length);
    for (const d of healthMetricModule.definitions) {
      expect(d.id.startsWith('health.')).toBe(true);
      expect(d.calcVersion).toBe(1);
    }
  });
});

function whereOf(fn: jest.Mock): Record<string, unknown> {
  const calls = fn.mock.calls as [{ where: Record<string, unknown> }][];
  return calls[0][0].where;
}
