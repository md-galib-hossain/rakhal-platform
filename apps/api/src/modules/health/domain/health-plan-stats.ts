/**
 * Protocol results (RAKHAL-466, MILESTONE 29 / ADR-029, PRD §13.6) — pure, no Prisma. A protocol card should show the
 * number that matters for *that kind* of protocol, computed live from what actually happened, not a stored figure:
 *  - **Treatment** → how many animals it was applied to, how many are in progress, and its **recovery rate**;
 *  - **Prevention / Breeding** → animals enrolled, completed, steps due soon, and its **coverage rate**.
 * Every rate is `null` until there is something to divide by — never a fake 0 %.
 * RAKHAL-470 adds the same two numbers to either kind — steps due today / overdue and the next due day (`PlanSchedule`).
 */

import { farmDaysUntil } from './health-farm-day';

export type PlanKind = 'TREATMENT' | 'PREVENTION' | 'BREEDING';

/** `TREATMENT` is curative; `BREEDING` keeps its own label; everything else (prevention, vaccination, deworming,
 * routine) is preventive care. Mirrors the UI's single "kind" (EPIC D7) without touching the two DB classifiers. */
export function planKind(category: string): PlanKind {
  if (category === 'TREATMENT') return 'TREATMENT';
  if (category === 'BREEDING') return 'BREEDING';
  return 'PREVENTION';
}

const OPEN_CASE_STATUSES = new Set([
  'ACTIVE',
  'IMPROVING',
  'WORSENING',
  'STABLE',
]);

export interface PlanCaseFact {
  cattleId: string;
  status: string;
}
export interface PlanEnrollmentFact {
  cattleId: string;
  /** `ACTIVE` | `COMPLETED` */
  status: string;
}

/**
 * RAKHAL-470 — where a protocol's open work stands today, on the farm's calendar day. Counts are steps (one per animal
 * per step), over animals still in the active herd whose case is open / enrollment is active.
 */
export interface PlanSchedule {
  /** Open steps due today. */
  stepsDue: number;
  /** Open steps whose due day has passed. */
  stepsOverdue: number;
  /** Farm-local `YYYY-MM-DD` of the earliest open step (may be in the past), or `null` with no open step. */
  nextDueDate: string | null;
}

export const NO_SCHEDULE: PlanSchedule = {
  stepsDue: 0,
  stepsOverdue: 0,
  nextDueDate: null,
};

/** Splits open step due-times into "due today" and "overdue" by the farm's calendar day — a step due 23:30 farm time is
 * today until midnight there, whatever the UTC clock says (same rule as the reminders). */
export function countStepsByFarmDay(
  dueTimes: Date[],
  timezone: string,
  now: Date = new Date(),
): Pick<PlanSchedule, 'stepsDue' | 'stepsOverdue'> {
  let stepsDue = 0;
  let stepsOverdue = 0;
  for (const due of dueTimes) {
    const days = farmDaysUntil(due, timezone, now);
    if (days === 0) stepsDue += 1;
    else if (days < 0) stepsOverdue += 1;
  }
  return { stepsDue, stepsOverdue };
}

export interface PlanStats extends PlanSchedule {
  kind: PlanKind;
  /** Distinct animals the protocol has been applied to. */
  appliedTo: number;
  /** Open cases (treatment) or still-active enrollments (prevention / breeding). */
  inProgress: number;
  // Treatment
  recovered: number | null;
  mortality: number | null;
  /** `recovered ÷ (recovered + mortality)` as a percentage, one decimal. */
  recoveryRate: number | null;
  // Prevention / breeding
  completed: number | null;
  /** Open steps due within the next 7 days, plus any already overdue. */
  due: number | null;
  /** `completed ÷ enrollments` as a percentage, one decimal. */
  coverageRate: number | null;
}

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

export function computePlanStats(
  category: string,
  cases: PlanCaseFact[],
  enrollments: PlanEnrollmentFact[],
  dueSteps: number,
  schedule: PlanSchedule = NO_SCHEDULE,
): PlanStats {
  const kind = planKind(category);

  if (kind === 'TREATMENT') {
    const recovered = cases.filter((c) => c.status === 'RECOVERED').length;
    const mortality = cases.filter((c) => c.status === 'MORTALITY').length;
    return {
      ...schedule,
      kind,
      appliedTo: new Set(cases.map((c) => c.cattleId)).size,
      inProgress: cases.filter((c) => OPEN_CASE_STATUSES.has(c.status)).length,
      recovered,
      mortality,
      recoveryRate: pct(recovered, recovered + mortality),
      completed: null,
      due: null,
      coverageRate: null,
    };
  }

  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  return {
    ...schedule,
    kind,
    appliedTo: new Set(enrollments.map((e) => e.cattleId)).size,
    inProgress: enrollments.filter((e) => e.status === 'ACTIVE').length,
    recovered: null,
    mortality: null,
    recoveryRate: null,
    completed,
    due: dueSteps,
    coverageRate: pct(completed, enrollments.length),
  };
}
