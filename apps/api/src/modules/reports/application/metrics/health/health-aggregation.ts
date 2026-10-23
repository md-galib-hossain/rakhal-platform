import {
  findPreviousSameCondition,
  type CaseTimeline,
} from 'src/modules/health/domain/health-case-outcome';
import { add, round2, toMoney, zero, type Money } from 'src/common/money';
import {
  valueOf,
  type MetricValue,
} from '../../../domain/contracts/metric-value';

/**
 * Pure health aggregation (RPT-05a). No Prisma, no clock: every "now" is passed in. Row shapes are
 * plain so the fetch layer and the unit tests share them.
 */

export interface CaseRow {
  id: string;
  cattleId: string;
  condition: string | null;
  status: string;
  startDate: Date;
  closedDate: Date | null;
}

export interface TreatmentRow {
  id: string;
  cattleId: string;
  financeTransactionId: string | null;
  /** Vet fee on the log (Decimal in Prisma; number/string accepted). Optional for plain count rows. */
  vetCost?: number | string | { toString(): string } | null;
  vetExpenseId?: string | null;
}

export interface TaskRow {
  id: string;
  cattleId: string;
  /** Non-null => preventive round task (PlanEnrollment); null => curative case task. */
  planEnrollmentId: string | null;
  status: string;
  dueDateTime: Date;
  completedAt: Date | null;
}

export interface WithdrawalRow {
  id: string;
  cattleId: string;
  status: string;
}

export interface Window {
  start: Date; // inclusive
  end: Date; // exclusive
}

export const CLOSED_CASE_STATUSES: readonly string[] = [
  'RECOVERED',
  'MORTALITY',
  'CLOSED',
];

/**
 * Task statuses that can still be acted on. Mirrors LIVE_TASK_STATUSES in
 * health-reminder.service.ts (PENDING, RESCHEDULED, OVERDUE): a RESCHEDULED task keeps a live
 * status with a new dueDateTime, so it is overdue when that new time has passed.
 */
export const LIVE_TASK_STATUSES: readonly string[] = [
  'PENDING',
  'RESCHEDULED',
  'OVERDUE',
];

const inWindow = (d: Date | null, w: Window): boolean =>
  !!d && d.getTime() >= w.start.getTime() && d.getTime() < w.end.getTime();

export function distinct(ids: Iterable<string>): string[] {
  return Array.from(new Set(ids));
}

export interface CountWithCows {
  events: number;
  cows: string[];
}

const countWithCows = (rows: { cattleId: string }[]): CountWithCows => ({
  events: rows.length,
  cows: distinct(rows.map((r) => r.cattleId)),
});

/** Cases (already CURATIVE-only) opened in the window: event count AND distinct cows, never conflated. */
export function casesOpened(cases: CaseRow[], w: Window): CountWithCows {
  return countWithCows(cases.filter((c) => inWindow(c.startDate, w)));
}

export function casesClosed(cases: CaseRow[], w: Window): number {
  return cases.filter(
    (c) => CLOSED_CASE_STATUSES.includes(c.status) && inWindow(c.closedDate, w),
  ).length;
}

export function casesRecovered(cases: CaseRow[], w: Window): number {
  return cases.filter(
    (c) => c.status === 'RECOVERED' && inWindow(c.closedDate, w),
  ).length;
}

export function casesMortality(cases: CaseRow[], w: Window): number {
  return cases.filter(
    (c) => c.status === 'MORTALITY' && inWindow(c.closedDate, w),
  ).length;
}

/** Started before the window ended and not closed by then (closedDate null/after end and status still open). */
export function casesOpenAt(cases: CaseRow[], at: Date): number {
  return cases.filter((c) => {
    if (c.startDate.getTime() >= at.getTime()) return false;
    if (c.closedDate) return c.closedDate.getTime() >= at.getTime();
    return !CLOSED_CASE_STATUSES.includes(c.status);
  }).length;
}

/** Non-voided treatment logs (the fetch layer filters voidedAt:null). Events and distinct cows. */
export function treatmentsGiven(treatments: TreatmentRow[]): CountWithCows {
  return countWithCows(treatments);
}

/**
 * Overdue is DERIVED, never read from a stored status (nothing writes OVERDUE): a task in a live
 * status whose dueDateTime is before `now`.
 */
export function overdueTasks(tasks: TaskRow[], now: Date): TaskRow[] {
  return tasks.filter(
    (t) =>
      LIVE_TASK_STATUSES.includes(t.status) &&
      t.dueDateTime.getTime() < now.getTime(),
  );
}

export function preventiveCompleted(tasks: TaskRow[], w: Window): number {
  return tasks.filter(
    (t) =>
      t.planEnrollmentId !== null &&
      t.status === 'COMPLETED' &&
      inWindow(t.completedAt, w),
  ).length;
}

export function preventiveMissed(tasks: TaskRow[], w: Window): number {
  return tasks.filter(
    (t) =>
      t.planEnrollmentId !== null &&
      t.status === 'MISSED' &&
      inWindow(t.dueDateTime, w),
  ).length;
}

/**
 * Cases opened in the window whose previous same-condition case (same cow) closed no more than
 * `windowDays` before this one started (closed exactly `windowDays` before still counts). A case
 * with a null condition is NEVER matched. `candidates` are other cases of the same cows.
 */
export function repeatedCases(
  opened: CaseRow[],
  candidates: CaseRow[],
  windowDays: number,
): CountWithCows {
  const timelines: CaseTimeline[] = candidates.map(toTimeline);
  const repeated = opened.filter(
    (c) =>
      findPreviousSameCondition(toTimeline(c), timelines, windowDays) !== null,
  );
  return countWithCows(repeated);
}

const toTimeline = (c: CaseRow): CaseTimeline => ({
  id: c.id,
  cattleId: c.cattleId,
  condition: c.condition,
  startDate: c.startDate,
  closedDate: c.closedDate,
});

/**
 * Withdrawals still in force: ACTIVE plus READY_FOR_RELEASE (matches HealthService
 * getSafetyWithdrawals activeOnly). RELEASED and CANCELLED are excluded.
 */
export const ACTIVE_WITHDRAWAL_STATUSES: readonly string[] = [
  'ACTIVE',
  'READY_FOR_RELEASE',
];

export function activeWithdrawals(rows: WithdrawalRow[]): CountWithCows {
  return countWithCows(
    rows.filter((r) => ACTIVE_WITHDRAWAL_STATUSES.includes(r.status)),
  );
}

export interface CostResult {
  value: MetricValue;
  /** Some treatments had a cost that could not be resolved to a non-voided expense. */
  hasUnresolved: boolean;
  /** A value was produced from only part of the treatments. */
  partial: boolean;
}

const MISSING_REASON = 'reports.dq.unknown_costs';

function finishCost(
  candidates: number,
  resolved: number,
  total: Money,
  unit: string,
): CostResult {
  if (candidates === 0)
    return {
      value: valueOf(0, unit),
      hasUnresolved: false,
      partial: false,
    };
  if (resolved === 0)
    return {
      value: { state: 'missing', reason: MISSING_REASON },
      hasUnresolved: true,
      partial: false,
    };
  const partial = resolved < candidates;
  return {
    value: valueOf(round2(total).toNumber(), unit),
    hasUnresolved: partial,
    partial,
  };
}

/**
 * Vet fees over non-voided treatments (fetch filters voidedAt:null). A treatment with a vetCost
 * needs its own non-voided Expense (vetExpenseId in `amountById`) to count; otherwise the fee is
 * unresolved (never 0). Double-count rule: vetExpenseId equal to financeTransactionId is the SAME
 * Expense already in treatment_cost, so it is skipped entirely.
 */
export function vetFees(
  treatments: TreatmentRow[],
  amountById: ReadonlyMap<string, Money>,
  unit = 'BDT',
): CostResult {
  let candidates = 0;
  let resolved = 0;
  let total = zero();
  for (const t of treatments) {
    if (t.vetCost === null || t.vetCost === undefined) continue;
    if (t.vetExpenseId && t.vetExpenseId === t.financeTransactionId) continue;
    candidates++;
    if (t.vetExpenseId && amountById.has(t.vetExpenseId)) {
      resolved++;
      total = add(total, toMoney(t.vetCost.toString()));
    }
  }
  return finishCost(candidates, resolved, total, unit);
}

/**
 * Sum of non-voided expense amounts linked from treatments. `amountById` holds only non-voided
 * expenses. Treatments with no financeTransactionId, or whose expense is voided/absent, are
 * unresolved (counted toward the partial/unknown note), never 0 cost.
 */
export function treatmentCost(
  treatments: TreatmentRow[],
  amountById: ReadonlyMap<string, Money>,
  unit = 'BDT',
): CostResult {
  let resolved = 0;
  let total = zero();
  for (const t of treatments) {
    const amt = t.financeTransactionId
      ? amountById.get(t.financeTransactionId)
      : undefined;
    if (amt !== undefined) {
      resolved++;
      total = add(total, amt);
    }
  }
  return finishCost(treatments.length, resolved, total, unit);
}
