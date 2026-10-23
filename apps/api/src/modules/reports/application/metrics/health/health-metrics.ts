import { buildDataQuality } from '../../../domain/eligibility/data-quality';
import type { DataQuality } from '../../../domain/contracts/data-quality';
import type { MetricId } from '../../../domain/contracts/metric-definition';
import {
  compareMetric,
  valueOf,
  type MetricResult,
  type MetricValue,
} from '../../../domain/contracts/metric-value';
import type { ReportException } from '../../../domain/contracts/snapshot';
import type {
  DomainMetricModule,
  DomainMetricOutput,
  MetricContext,
} from '../metric-context';
import {
  activeWithdrawals,
  casesClosed,
  casesMortality,
  casesOpenAt,
  casesOpened,
  casesRecovered,
  distinct,
  overdueTasks,
  preventiveCompleted,
  preventiveMissed,
  repeatedCases,
  treatmentCost,
  treatmentsGiven,
  vetFees,
  type Window,
} from './health-aggregation';
import { HEALTH_DEFINITIONS } from './health-definitions';
import {
  fetchActiveWithdrawals,
  fetchCases,
  fetchExpenseAmounts,
  fetchRepeatCandidates,
  fetchTasks,
  fetchTreatments,
  toWindow,
} from './health-fetch';

/** Figures that can be compared with the previous period (period-bound, not point-in-time). */
interface PeriodFigures {
  casesOpened: number;
  cowsWithCases: number;
  treatments: number;
  cowsTreated: number;
  closed: number;
  recovered: number;
  mortality: number;
  preventiveCompleted: number;
  preventiveMissed: number;
  repeated: number;
  /** null when finance is excluded: never computed. */
  cost: MetricValue | null;
  /** null when finance is excluded: never computed. */
  vetFees: MetricValue | null;
  /** Cows whose repeated case was opened in the period (exception list). */
  repeatedCows: string[];
  /** Some treatment/vet cost could not be resolved to a non-voided expense. */
  hasUnknownCosts: boolean;
  /** A cost value was produced from only part of the treatments. */
  hasPartialCosts: boolean;
}

async function loadPeriodFigures(
  ctx: MetricContext,
  w: Window,
  cattleIds: readonly string[],
): Promise<PeriodFigures> {
  const scope = { db: ctx.db, farmId: ctx.farmId, cattleIds };
  const [cases, treatments, tasks] = await Promise.all([
    fetchCases(scope, w),
    fetchTreatments(scope, w),
    fetchTasks(scope, w, null),
  ]);
  const opened = casesOpened(cases, w);
  const treated = treatmentsGiven(treatments);
  const openedCases = cases.filter(
    (c) =>
      c.startDate.getTime() >= w.start.getTime() &&
      c.startDate.getTime() < w.end.getTime(),
  );
  const candidates = openedCases.some((c) => c.condition)
    ? await fetchRepeatCandidates(
        scope,
        w,
        distinct(openedCases.filter((c) => c.condition).map((c) => c.cattleId)),
        ctx.thresholds.repeatedCaseWindowDays,
      )
    : [];
  const repeated = repeatedCases(
    openedCases,
    candidates,
    ctx.thresholds.repeatedCaseWindowDays,
  );
  let cost: MetricValue | null = null;
  let vet: MetricValue | null = null;
  let hasUnknownCosts = false;
  let hasPartialCosts = false;
  if (ctx.includeFinance) {
    const amounts = await fetchExpenseAmounts(
      scope,
      [
        ...treatments.map((t) => t.financeTransactionId),
        ...treatments.map((t) => t.vetExpenseId),
      ].filter((id): id is string => !!id),
    );
    const c = treatmentCost(treatments, amounts);
    const v = vetFees(treatments, amounts);
    cost = c.value;
    vet = v.value;
    hasUnknownCosts = c.hasUnresolved || v.hasUnresolved;
    hasPartialCosts = c.partial || v.partial;
  }
  return {
    casesOpened: opened.events,
    cowsWithCases: opened.cows.length,
    treatments: treated.events,
    cowsTreated: treated.cows.length,
    closed: casesClosed(cases, w),
    recovered: casesRecovered(cases, w),
    mortality: casesMortality(cases, w),
    preventiveCompleted: preventiveCompleted(tasks, w),
    preventiveMissed: preventiveMissed(tasks, w),
    repeated: repeated.events,
    repeatedCows: repeated.cows,
    cost,
    vetFees: vet,
    hasUnknownCosts,
    hasPartialCosts,
  };
}

const NA: MetricValue = { state: 'not_applicable' };

type Num = (f: PeriodFigures) => number | MetricValue | null;

function emptyOutput(): DomainMetricOutput {
  return {
    section: {
      id: 'health',
      domain: 'health',
      titleKey: 'reports.section.health',
      metrics: [],
    },
    exceptions: [],
    dataQuality: buildDataQuality({
      coverage: { expected: 0, recorded: 0 },
      scopeEmpty: true,
    }),
  };
}

function withPartialNote(dq: DataQuality, partial: boolean): DataQuality {
  return partial
    ? { ...dq, notes: [...dq.notes, 'reports.dq.partial_costs'] }
    : dq;
}

async function compute(ctx: MetricContext): Promise<DomainMetricOutput> {
  const defs = HEALTH_DEFINITIONS.filter(
    (d) => ctx.includeFinance || d.requiresPermission !== 'finance.read',
  );
  const metrics: MetricResult[] = [];

  // Empty scope: nothing to measure. Explicit not_applicable, never a silent 0.
  if (ctx.cattleIds.length === 0) {
    const out = emptyOutput();
    return {
      ...out,
      section: {
        id: 'health',
        domain: 'health',
        titleKey: 'reports.section.health',
        metrics: defs.map((d) => ({
          metricId: d.id,
          value: NA,
          source: null,
          comparison: null,
          requiresPermission: d.requiresPermission ?? null,
        })),
      },
    };
  }

  const w = toWindow(ctx.period);
  const scope = { db: ctx.db, farmId: ctx.farmId, cattleIds: ctx.cattleIds };
  const cur = await loadPeriodFigures(ctx, w, ctx.cattleIds);

  let prev: PeriodFigures | null = null;
  if (ctx.previousPeriod && ctx.previousCattleIds.length > 0) {
    prev = await loadPeriodFigures(
      ctx,
      toWindow(ctx.previousPeriod),
      ctx.previousCattleIds,
    );
  }

  // Point-in-time figures (no comparison).
  const [openCases, taskRows, withdrawals] = await Promise.all([
    fetchCases(scope, w),
    fetchTasks(scope, w, ctx.generatedAt),
    fetchActiveWithdrawals(scope),
  ]);
  const overdue = overdueTasks(taskRows, ctx.generatedAt);
  const active = activeWithdrawals(withdrawals);

  const add = (id: MetricId, pick: Num, source: string | null = null): void => {
    const def = defs.find((d) => d.id === id);
    if (!def) return;
    const c = pick(cur);
    if (c === null) return;
    const value = typeof c === 'number' ? valueOf(c, def.unit) : c;
    let comparison: MetricResult['comparison'] = null;
    if (ctx.previousPeriod) {
      const p = prev ? pick(prev) : null;
      comparison = compareMetric(
        value,
        p === null ? NA : typeof p === 'number' ? valueOf(p, def.unit) : p,
      );
    }
    metrics.push({
      metricId: id,
      value,
      source,
      comparison,
      requiresPermission: def.requiresPermission ?? null,
    });
  };
  const addPoint = (id: MetricId, n: number): void => {
    const def = defs.find((d) => d.id === id)!;
    metrics.push({
      metricId: id,
      value: valueOf(n, def.unit),
      source: null,
      comparison: null,
      requiresPermission: null,
    });
  };

  add('health.cases_opened', (f) => f.casesOpened);
  add('health.cows_with_cases_opened', (f) => f.cowsWithCases);
  add('health.treatments_given', (f) => f.treatments);
  add('health.cows_treated', (f) => f.cowsTreated);
  add('health.cases_closed', (f) => f.closed);
  add('health.cases_recovered', (f) => f.recovered);
  add('health.cases_mortality', (f) => f.mortality);
  addPoint('health.cases_open_at_period_end', casesOpenAt(openCases, w.end));
  add('health.preventive_tasks_completed', (f) => f.preventiveCompleted);
  add('health.preventive_tasks_missed', (f) => f.preventiveMissed);
  addPoint('health.tasks_overdue', overdue.length);
  add('health.cases_repeated', (f) => f.repeated);
  addPoint('health.withdrawals_active', active.events);
  add('health.treatment_cost', (f) => f.cost);
  add('health.vet_fees', (f) => f.vetFees, 'vet_fee');

  const exceptions: ReportException[] = [];
  if (overdue.length > 0) {
    exceptions.push({
      code: 'health.overdue_tasks',
      domain: 'health',
      messageKey: 'reports.exceptions.health.overdue_tasks',
      cattleIds: distinct(overdue.map((t) => t.cattleId)),
    });
  }
  if (cur.repeatedCows.length > 0) {
    exceptions.push({
      code: 'health.repeated_cases',
      domain: 'health',
      messageKey: 'reports.exceptions.health.repeated_cases',
      cattleIds: cur.repeatedCows,
    });
  }
  // No "open case older than N days" exception: ctx.thresholds defines no such threshold.

  return {
    section: {
      id: 'health',
      domain: 'health',
      titleKey: 'reports.section.health',
      metrics,
    },
    exceptions,
    // Health is event-based (no per-day expected entry), so every in-scope cow is "covered".
    dataQuality: withPartialNote(
      buildDataQuality({
        coverage: {
          expected: ctx.cattleIds.length,
          recorded: ctx.cattleIds.length,
        },
        hasUnknownCosts: ctx.includeFinance && cur.hasUnknownCosts,
      }),
      ctx.includeFinance && cur.hasPartialCosts,
    ),
  };
}

export const healthMetricModule: DomainMetricModule = {
  definitions: HEALTH_DEFINITIONS,
  compute,
};
