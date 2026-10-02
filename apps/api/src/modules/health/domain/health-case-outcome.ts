/**
 * Case results (RAKHAL-467, MILESTONE 29 / ADR-029, PRD §13.9) — pure, no Prisma. "What was the sickness, what did we
 * do, what was the result" is derived from facts the case already holds (dates, status, treatment cost, condition), not
 * from a new outcome enum: closing stays `RECOVERED | MORTALITY`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The same animal + same condition within this many days of the previous case closing counts as a recurrence. */
export const RECURRENCE_WINDOW_DAYS = 60;

/** Elapsed time rounded **up** to whole days, never below 1 (reported and closed the same afternoon = 1 day). Real
 * elapsed time rather than calendar days, so it does not depend on a timezone. */
export function elapsedDays(from: Date, to: Date): number {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

/** "Day N of illness": the day of reporting is day 1. */
export function dayOfIllness(start: Date, now: Date): number {
  return Math.max(
    1,
    Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1,
  );
}

export interface CaseTimeline {
  id: string;
  cattleId: string;
  condition: string | null;
  startDate: Date;
  closedDate: Date | null;
}

/**
 * The most recent earlier case for the same animal and the same structured condition that closed no more than
 * `windowDays` before `current` started. Needs a condition — a case reported with only a free-text note cannot be
 * called a recurrence of anything (do not guess a condition from text, RAKHAL-418).
 */
export function findPreviousSameCondition(
  current: CaseTimeline,
  others: CaseTimeline[],
  windowDays: number = RECURRENCE_WINDOW_DAYS,
): CaseTimeline | null {
  if (!current.condition) return null;
  const earliest = current.startDate.getTime() - windowDays * DAY_MS;
  let best: CaseTimeline | null = null;
  for (const other of others) {
    if (other.id === current.id) continue;
    if (other.cattleId !== current.cattleId) continue;
    if (other.condition !== current.condition) continue;
    if (!other.closedDate) continue;
    const closed = other.closedDate.getTime();
    if (closed > current.startDate.getTime() || closed < earliest) continue;
    if (!best || closed > best.closedDate!.getTime()) best = other;
  }
  return best;
}

export interface OutcomeCase {
  condition: string | null;
  status: string;
  startDate: Date;
  closedDate: Date | null;
  /** Sum of the case's posted treatment cost (non-voided). */
  cost: number;
  isRecurrence: boolean;
}

export interface OutcomeBreakdown {
  cases: number;
  recovered: number;
  mortality: number;
  /** `recovered ÷ (recovered + mortality)` as a percentage with one decimal; `null` until a case has a recorded
   * outcome — never a fake 0 %. */
  recoveryRate: number | null;
  avgDaysToRecover: number | null;
  avgCost: number | null;
}

export interface OutcomeSummary extends OutcomeBreakdown {
  openCases: number;
  /** Closed without a recorded recovery or death — e.g. auto-closed when its protocol finished
   * (`closeReason: 'protocol_completed'`). Kept out of the recovery rate rather than guessed. */
  otherClosed: number;
  totalCost: number;
  recurrenceRate: number | null;
  byCondition: (OutcomeBreakdown & { condition: string | null })[];
}

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const mean = (values: number[], places: number) =>
  values.length
    ? round(values.reduce((a, b) => a + b, 0) / values.length, places)
    : null;

function breakdown(cases: OutcomeCase[]): OutcomeBreakdown {
  const recoveredCases = cases.filter((c) => c.status === 'RECOVERED');
  const mortality = cases.filter((c) => c.status === 'MORTALITY').length;
  const decided = recoveredCases.length + mortality;
  return {
    cases: cases.length,
    recovered: recoveredCases.length,
    mortality,
    recoveryRate: decided
      ? round((recoveredCases.length / decided) * 100, 1)
      : null,
    avgDaysToRecover: mean(
      recoveredCases
        .filter((c) => c.closedDate)
        .map((c) => elapsedDays(c.startDate, c.closedDate!)),
      1,
    ),
    avgCost: mean(
      cases.map((c) => c.cost),
      2,
    ),
  };
}

/** Farm-level results over a cohort of cases (the ones opened inside the window). `avgCost` is total cost ÷ all cases
 * in the group, including ones with no costed treatment — a case that cost nothing is still a case. */
export function aggregateOutcomes(cases: OutcomeCase[]): OutcomeSummary {
  const closedStatuses = new Set(['RECOVERED', 'MORTALITY', 'CLOSED']);
  const open = cases.filter((c) => !closedStatuses.has(c.status));
  const base = breakdown(cases);

  const byKey = new Map<string | null, OutcomeCase[]>();
  for (const c of cases) {
    const list = byKey.get(c.condition);
    if (list) list.push(c);
    else byKey.set(c.condition, [c]);
  }
  const byCondition = [...byKey.entries()]
    .map(([condition, list]) => ({ condition, ...breakdown(list) }))
    // Biggest group first; ties alphabetically; cases with no structured condition last.
    .sort(
      (a, b) =>
        b.cases - a.cases ||
        Number(a.condition === null) - Number(b.condition === null) ||
        String(a.condition).localeCompare(String(b.condition)),
    );

  return {
    ...base,
    openCases: open.length,
    otherClosed: cases.filter((c) => c.status === 'CLOSED').length,
    totalCost: round(
      cases.reduce((sum, c) => sum + c.cost, 0),
      2,
    ),
    recurrenceRate: cases.length
      ? round(
          (cases.filter((c) => c.isRecurrence).length / cases.length) * 100,
          1,
        )
      : null,
    byCondition,
  };
}
