import { Prisma } from '@prisma/client';
import type { MetricContext } from '../metric-context';
import { financeMetricModule } from './index';

interface Tx {
  date: string;
  sourceType: string;
  reversalOfId?: string | null;
  reversed?: boolean;
}
interface Entry {
  acct: string;
  debit: string;
  credit: string;
  tx: Tx;
}
interface Exp {
  category: string;
  amount: string;
  date: string;
  voidedAt?: Date | null;
}

interface W {
  ledgerAccountId: { in: string[] };
  journalTransaction: W;
  transactionDate: { gte: Date; lt: Date };
  reversalOfId?: null;
  reversedBy?: { none: object };
  sourceType?: string | { notIn: string[] };
  voidedAt?: null;
  expenseDate: { gte: Date; lt: Date };
}

const D = (s: string | undefined) => new Prisma.Decimal(s ?? 0);

/** In-memory db that interprets exactly the where-clauses the finance module issues. */
function fakeDb(opts: {
  accounts: string[];
  entries?: Entry[];
  expenses?: Exp[];
}) {
  const calls = jest.fn<void, [string, unknown]>();
  const entries = opts.entries ?? [];
  const expenses = opts.expenses ?? [];
  const txMatch = (t: Tx, w: W) => {
    const d = new Date(t.date);
    if (w.transactionDate?.gte && d < w.transactionDate.gte) return false;
    if (w.transactionDate?.lt && d >= w.transactionDate.lt) return false;
    if ('reversalOfId' in w && w.reversalOfId === null && t.reversalOfId)
      return false;
    if (w.reversedBy?.none && t.reversed) return false;
    if (typeof w.sourceType === 'string' && t.sourceType !== w.sourceType)
      return false;
    if (
      typeof w.sourceType === 'object' &&
      w.sourceType.notIn.includes(t.sourceType)
    )
      return false;
    return true;
  };
  const db = {
    financialAccount: {
      findMany: (a: unknown) => {
        calls('fa', a);
        return Promise.resolve(
          opts.accounts.map((l) => ({ ledgerAccountId: l })),
        );
      },
    },
    journalEntry: {
      aggregate: ({ where }: { where: W }) => {
        calls('je', where);
        const rows = entries.filter(
          (e) =>
            where.ledgerAccountId.in.includes(e.acct) &&
            txMatch(e.tx, where.journalTransaction),
        );
        const sum = (k: 'debit' | 'credit') =>
          rows.reduce((a, r) => a.plus(D(r[k])), D('0'));
        return Promise.resolve({
          _sum: { debit: sum('debit'), credit: sum('credit') },
        });
      },
    },
    expense: {
      groupBy: ({ where }: { where: W }) => {
        calls('ex', where);
        const m = new Map<string, Prisma.Decimal>();
        for (const e of expenses) {
          const d = new Date(e.date);
          if (where.voidedAt === null && e.voidedAt) continue;
          if (d < where.expenseDate.gte || d >= where.expenseDate.lt) continue;
          m.set(e.category, (m.get(e.category) ?? D('0')).plus(D(e.amount)));
        }
        return Promise.resolve(
          [...m].map(([category, amount]) => ({ category, _sum: { amount } })),
        );
      },
    },
  };
  return { db, calls };
}

const period = (start: string, end: string) => ({
  start,
  end,
  startDate: start.slice(0, 10),
  endDate: end.slice(0, 10),
  timezone: 'Asia/Dhaka',
  label: 'x',
});
const CUR = period('2026-10-05T00:00:00Z', '2026-10-12T00:00:00Z');
const PREV = period('2026-09-28T00:00:00Z', '2026-10-05T00:00:00Z');

function ctx(db: unknown, over: Partial<MetricContext> = {}): MetricContext {
  return {
    db: db as MetricContext['db'],
    farmId: 'f1',
    timezone: 'Asia/Dhaka',
    period: CUR,
    previousPeriod: null,
    scopeKind: 'ALL_ELIGIBLE',
    cattleIds: [],
    previousCattleIds: [],
    generatedAt: new Date('2026-10-13T00:00:00Z'),
    thresholds: {
      suddenDropPct: 30,
      repeatedCaseWindowDays: 60,
      finalizationMaxWaitHours: 6,
    },
    includeFinance: true,
    ...over,
  };
}

const tx = (
  date: string,
  sourceType = 'SALE',
  extra: Partial<Tx> = {},
): Tx => ({
  date,
  sourceType,
  ...extra,
});
const metric = (
  out: Awaited<ReturnType<typeof financeMetricModule.compute>>,
  id: string,
) => out.section?.metrics.find((m) => m.metricId === id);
const val = (m: ReturnType<typeof metric>) =>
  m?.value.state === 'value' ? m.value.value : m?.value.state;

describe('financeMetricModule', () => {
  it('declares finance.read on every definition', () => {
    expect(financeMetricModule.definitions.length).toBeGreaterThan(5);
    for (const d of financeMetricModule.definitions) {
      expect(d.requiresPermission).toBe('finance.read');
      expect(d.id.startsWith('finance.')).toBe(true);
      expect(d.calcVersion).toBe(1);
    }
  });

  it('makes zero db calls and leaks nothing when includeFinance is false', async () => {
    const { db, calls } = fakeDb({ accounts: ['L1'] });
    const out = await financeMetricModule.compute(
      ctx(db, { includeFinance: false }),
    );
    expect(calls).not.toHaveBeenCalled();
    expect(out.section).toBeNull();
    expect(out.exceptions).toEqual([]);
    expect(out.dataQuality.notes).toEqual([]);
    expect(out.dataQuality.coverage).toEqual({ expected: 0, recorded: 0 });
  });

  it('excludes transfers from receipts/payments but counts the fee as paid', async () => {
    const { db } = fakeDb({
      accounts: ['A', 'B'],
      entries: [
        {
          acct: 'A',
          debit: '1000',
          credit: '0',
          tx: tx('2026-10-06T00:00:00Z'),
        },
        // transfer A -> B of 500 with fee 10 from A
        {
          acct: 'A',
          debit: '0',
          credit: '500',
          tx: tx('2026-10-07T00:00:00Z', 'FINANCE_TRANSFER'),
        },
        {
          acct: 'B',
          debit: '500',
          credit: '0',
          tx: tx('2026-10-07T00:00:00Z', 'FINANCE_TRANSFER'),
        },
        {
          acct: 'A',
          debit: '0',
          credit: '10',
          tx: tx('2026-10-07T00:00:00Z', 'FINANCE_TRANSFER'),
        },
        // opening balance seeding is not income
        {
          acct: 'B',
          debit: '300',
          credit: '0',
          tx: tx('2026-10-08T00:00:00Z', 'FINANCIAL_ACCOUNT_OPENING_BALANCE'),
        },
      ],
    });
    const out = await financeMetricModule.compute(ctx(db));
    expect(val(metric(out, 'finance.cash_received'))).toBe(1000);
    expect(val(metric(out, 'finance.cash_paid'))).toBe(10);
    expect(val(metric(out, 'finance.net_cash_flow'))).toBe(990);
    expect(metric(out, 'finance.cash_received')?.source).toBe('cash_ledger');
    // balances include everything
    expect(val(metric(out, 'finance.closing_cash_balance'))).toBe(1290);
  });

  it('counts a reversal pair inside the periods each side posts (same period nets to zero)', async () => {
    const { db } = fakeDb({
      accounts: ['A'],
      entries: [
        {
          acct: 'A',
          debit: '700',
          credit: '0',
          tx: tx('2026-10-06T00:00:00Z', 'SALE', { reversed: true }),
        },
        {
          acct: 'A',
          debit: '0',
          credit: '700',
          tx: tx('2026-10-07T00:00:00Z', 'SALE', { reversalOfId: 't1' }),
        },
        { acct: 'A', debit: '50', credit: '0', tx: tx('2026-10-08T00:00:00Z') },
      ],
    });
    const out = await financeMetricModule.compute(ctx(db));
    expect(val(metric(out, 'finance.cash_received'))).toBe(750);
    expect(val(metric(out, 'finance.cash_paid'))).toBe(700);
    expect(val(metric(out, 'finance.net_cash_flow'))).toBe(50);
    expect(val(metric(out, 'finance.opening_cash_balance'))).toBe(0);
    expect(val(metric(out, 'finance.closing_cash_balance'))).toBe(50);
  });

  it('keeps opening + net flow = closing when original is in period A and reversal in B', async () => {
    const { db } = fakeDb({
      accounts: ['A'],
      entries: [
        {
          acct: 'A',
          debit: '700',
          credit: '0',
          tx: tx('2026-09-30T00:00:00Z', 'SALE', { reversed: true }),
        },
        {
          acct: 'A',
          debit: '0',
          credit: '700',
          tx: tx('2026-10-07T00:00:00Z', 'SALE', { reversalOfId: 't1' }),
        },
      ],
    });
    const out = await financeMetricModule.compute(
      ctx(db, { previousPeriod: PREV }),
    );
    const open = val(metric(out, 'finance.opening_cash_balance')) as number;
    const net = val(metric(out, 'finance.net_cash_flow')) as number;
    const close = val(metric(out, 'finance.closing_cash_balance')) as number;
    expect(open).toBe(700);
    expect(net).toBe(-700);
    expect(close).toBe(0);
    expect(open + net).toBe(close);
    // previous period holds the original: +700 flow, opening 0, closing 700
    const m = metric(out, 'finance.net_cash_flow');
    expect(m?.comparison?.previousState).toBe('value');
  });

  it('scopes every query by farm, void state and period bounds', async () => {
    const { db, calls } = fakeDb({ accounts: ['A'] });
    await financeMetricModule.compute(ctx(db));
    const start = new Date(CUR.start);
    const end = new Date(CUR.end);
    const byKind = (k: string) =>
      calls.mock.calls.filter((c) => c[0] === k).map((c) => c[1]);

    expect(byKind('fa')).toEqual([
      { where: { farmId: 'f1' }, select: { ledgerAccountId: true } },
    ]);
    const je = byKind('je') as Array<{
      ledgerAccountId: { in: string[] };
      journalTransaction: Record<string, unknown>;
    }>;
    expect(je.length).toBe(4);
    for (const w of je) expect(w.ledgerAccountId).toEqual({ in: ['A'] });
    expect(je[0].journalTransaction).toEqual({
      transactionDate: { gte: start, lt: end },
      sourceType: {
        notIn: ['FINANCE_TRANSFER', 'FINANCIAL_ACCOUNT_OPENING_BALANCE'],
      },
    });
    expect(je[1].journalTransaction).toEqual({
      transactionDate: { gte: start, lt: end },
      sourceType: 'FINANCE_TRANSFER',
    });
    expect(je[2].journalTransaction).toEqual({
      transactionDate: { lt: start },
    });
    expect(je[3].journalTransaction).toEqual({ transactionDate: { lt: end } });
    expect(byKind('ex')).toEqual([
      { farmId: 'f1', voidedAt: null, expenseDate: { gte: start, lt: end } },
    ]);
  });

  it('excludes voided expenses and reports by category with comparison', async () => {
    const { db } = fakeDb({
      accounts: ['A'],
      expenses: [
        { category: 'SALARY', amount: '100', date: '2026-10-06T00:00:00Z' },
        {
          category: 'SALARY',
          amount: '999',
          date: '2026-10-06T00:00:00Z',
          voidedAt: new Date(),
        },
        { category: 'SALARY', amount: '50', date: '2026-09-30T00:00:00Z' },
        { category: 'OTHER', amount: '20', date: '2026-10-09T00:00:00Z' },
      ],
    });
    const out = await financeMetricModule.compute(
      ctx(db, { previousPeriod: PREV }),
    );
    const sal = metric(out, 'finance.expenses_by_category.SALARY');
    expect(val(sal)).toBe(100);
    expect(sal?.comparison?.absoluteChange).toBe(50);
    expect(sal?.comparison?.percentChange).toBe(100);
    expect(val(metric(out, 'finance.expenses_total'))).toBe(120);
    expect(sal?.source).toBe('expense_accrual');
    // OTHER: previous 0 => percentChange null, never Infinity
    const other = metric(out, 'finance.expenses_by_category.OTHER');
    expect(other?.comparison?.percentChange).toBeNull();
  });

  it('distinguishes explicit zero (accounts, no activity) from missing (no accounts)', async () => {
    const withAcct = await financeMetricModule.compute(
      ctx(fakeDb({ accounts: ['A'] }).db),
    );
    expect(metric(withAcct, 'finance.cash_received')?.value).toEqual({
      state: 'value',
      value: 0,
      unit: 'BDT',
    });
    expect(val(metric(withAcct, 'finance.expenses_total'))).toBe(0);

    const none = await financeMetricModule.compute(
      ctx(fakeDb({ accounts: [] }).db),
    );
    expect(metric(none, 'finance.cash_received')?.value.state).toBe('missing');
    expect(metric(none, 'finance.opening_cash_balance')?.value.state).toBe(
      'missing',
    );
    expect(none.dataQuality.notes.length).toBe(1);
  });

  it('gives null percentChange when previous cash is zero', async () => {
    const { db } = fakeDb({
      accounts: ['A'],
      entries: [
        { acct: 'A', debit: '10', credit: '0', tx: tx('2026-10-06T00:00:00Z') },
      ],
    });
    const out = await financeMetricModule.compute(
      ctx(db, { previousPeriod: PREV }),
    );
    const m = metric(out, 'finance.cash_received');
    expect(m?.comparison?.previousState).toBe('value');
    expect(m?.comparison?.percentChange).toBeNull();
    // previous closing balance equals current opening balance
    expect(val(metric(out, 'finance.opening_cash_balance'))).toBe(0);
  });

  it('sums decimals exactly (0.1 + 0.2)', async () => {
    const { db } = fakeDb({
      accounts: ['A'],
      entries: [
        {
          acct: 'A',
          debit: '0.10',
          credit: '0',
          tx: tx('2026-10-06T00:00:00Z'),
        },
        {
          acct: 'A',
          debit: '0.20',
          credit: '0',
          tx: tx('2026-10-06T00:00:00Z'),
        },
      ],
      expenses: [
        { category: 'OTHER', amount: '0.10', date: '2026-10-06T00:00:00Z' },
        { category: 'OTHER', amount: '0.20', date: '2026-10-06T00:00:00Z' },
      ],
    });
    const out = await financeMetricModule.compute(ctx(db));
    expect(val(metric(out, 'finance.cash_received'))).toBe(0.3);
    expect(val(metric(out, 'finance.expenses_total'))).toBe(0.3);
  });
});
