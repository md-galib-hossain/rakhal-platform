import { add, round2, subtract, zero, type Money } from 'src/common/money';
import type { ReportPeriod } from '../../../domain/contracts/period';
import type { DataQuality } from '../../../domain/contracts/data-quality';
import {
  compareMetric,
  valueOf,
  type MetricResult,
  type MetricValue,
} from '../../../domain/contracts/metric-value';
import type { MetricId } from '../../../domain/contracts/metric-definition';
import type {
  DomainMetricModule,
  DomainMetricOutput,
  MetricContext,
} from '../metric-context';
import {
  CASH_PAID_ID,
  CASH_RECEIVED_ID,
  CLOSING_CASH_ID,
  EXPENSES_TOTAL_ID,
  FINANCE_DEFINITIONS,
  NET_CASH_FLOW_ID,
  OPENING_CASH_ID,
  expenseCategoryId,
} from './finance-definitions';
import {
  balanceBefore,
  cashFlow,
  cashLedgerIds,
  expensesByCategory,
} from './finance-queries';

const UNIT = 'BDT';
const defs = new Map(FINANCE_DEFINITIONS.map((d) => [d.id, d]));
/** Convert Decimal to number only at the edge, rounded to 2dp. */
const num = (m: Money): MetricValue => valueOf(round2(m).toNumber(), UNIT);
const NO_ACCOUNTS: MetricValue = {
  state: 'missing',
  reason: 'No financial accounts recorded for this farm',
};

const emptyQuality = (notes: string[]): DataQuality => ({
  coverage: { expected: 0, recorded: 0 },
  notes,
  flags: {
    incompleteCoverage: false,
    hasUnsubmittedDrafts: false,
    hasEstimatedValues: false,
    hasUnknownCosts: false,
    groupMembershipCurrentOnly: false,
  },
});

function result(
  id: MetricId,
  value: MetricValue,
  source: string,
  previous: MetricValue | null,
): MetricResult {
  return {
    metricId: id,
    value,
    source,
    comparison: previous ? compareMetric(value, previous) : null,
    requiresPermission: 'finance.read',
  };
}

interface CashSide {
  received: MetricValue;
  paid: MetricValue;
  net: MetricValue;
}

async function cashSide(
  ctx: MetricContext,
  ids: string[],
  p: ReportPeriod,
): Promise<CashSide> {
  if (ids.length === 0)
    return { received: NO_ACCOUNTS, paid: NO_ACCOUNTS, net: NO_ACCOUNTS };
  const f = await cashFlow(ctx.db, ids, new Date(p.start), new Date(p.end));
  return {
    received: num(f.received),
    paid: num(f.paid),
    net: num(subtract(f.received, f.paid)),
  };
}

async function expenseSide(ctx: MetricContext, p: ReportPeriod) {
  const byCat = await expensesByCategory(
    ctx.db,
    ctx.farmId,
    new Date(p.start),
    new Date(p.end),
  );
  let total: Money = zero();
  for (const v of byCat.values()) total = add(total, v);
  return { byCat, total };
}

async function compute(ctx: MetricContext): Promise<DomainMetricOutput> {
  const section = {
    id: 'finance',
    domain: 'finance' as const,
    titleKey: 'reports.sections.finance',
    metrics: [] as MetricResult[],
  };
  // Zero queries without finance.read; no section is emitted at all.
  if (!ctx.includeFinance)
    return { section: null, exceptions: [], dataQuality: emptyQuality([]) };

  const notes: string[] = [];
  const ids = await cashLedgerIds(ctx.db, ctx.farmId);
  if (ids.length === 0)
    notes.push('No financial accounts: cash figures unavailable.');

  const cur = await cashSide(ctx, ids, ctx.period);
  const prev = ctx.previousPeriod
    ? await cashSide(ctx, ids, ctx.previousPeriod)
    : null;
  const src = 'cash_ledger';
  section.metrics.push(
    result(CASH_RECEIVED_ID, cur.received, src, prev?.received ?? null),
    result(CASH_PAID_ID, cur.paid, src, prev?.paid ?? null),
    result(NET_CASH_FLOW_ID, cur.net, src, prev?.net ?? null),
  );

  if (ids.length === 0) {
    section.metrics.push(
      result(OPENING_CASH_ID, NO_ACCOUNTS, src, null),
      result(CLOSING_CASH_ID, NO_ACCOUNTS, src, null),
    );
  } else {
    const open = await balanceBefore(ctx.db, ids, new Date(ctx.period.start));
    const close = await balanceBefore(ctx.db, ids, new Date(ctx.period.end));
    const pp = ctx.previousPeriod;
    const prevOpen = pp
      ? num(await balanceBefore(ctx.db, ids, new Date(pp.start)))
      : null;
    const prevClose = pp
      ? num(await balanceBefore(ctx.db, ids, new Date(pp.end)))
      : null;
    section.metrics.push(
      result(OPENING_CASH_ID, num(open), src, prevOpen),
      result(CLOSING_CASH_ID, num(close), src, prevClose),
    );
  }

  const ec = await expenseSide(ctx, ctx.period);
  const ep = ctx.previousPeriod
    ? await expenseSide(ctx, ctx.previousPeriod)
    : null;
  const esrc = 'expense_accrual';
  section.metrics.push(
    result(EXPENSES_TOTAL_ID, num(ec.total), esrc, ep ? num(ep.total) : null),
  );
  const cats = new Set([...ec.byCat.keys(), ...(ep?.byCat.keys() ?? [])]);
  for (const c of [...cats].sort()) {
    const id = expenseCategoryId(c);
    if (!defs.has(id)) continue;
    section.metrics.push(
      result(
        id,
        num(ec.byCat.get(c) ?? zero()),
        esrc,
        ep ? num(ep.byCat.get(c) ?? zero()) : null,
      ),
    );
  }

  return { section, exceptions: [], dataQuality: emptyQuality(notes) };
}

export const financeMetricModule: DomainMetricModule = {
  definitions: FINANCE_DEFINITIONS,
  compute,
};
