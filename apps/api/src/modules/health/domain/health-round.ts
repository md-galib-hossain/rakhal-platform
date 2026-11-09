/**
 * Protocol rounds (RAKHAL-471 / 472, MILESTONE 29d — `docs/EPIC_PROTOCOL_ROUNDS.md`) — pure, no Prisma.
 *
 * A **round** is one application of a protocol on one farm-local day, with the animals that went through it together.
 *  - Preventive / breeding protocols already have the object: `PlanApplication` → N `PlanEnrollment` (`app:<id>`).
 *  - Treatment protocols do not — each animal gets its own `HealthCase` — so a round is *derived*: every case on the
 *    same protocol whose steps were created on the same farm day (`trt:<planId>:<yyyy-mm-dd>`, RD-116). The day is the
 *    day the protocol was applied (its first step was created), not the case's report day, so attaching a protocol to
 *    an older case still lands it in the right round.
 *
 * Counts follow the same "live" rule as the protocol cards and the reminders: only open steps of animals still in the
 * herd, on a case that is open / an enrollment that is active, count as due or overdue.
 */

import { farmDaysUntil } from './health-farm-day';

export type RoundKeyParts =
  | { type: 'APPLICATION'; applicationId: string }
  | { type: 'TREATMENT'; planId: string; day: string };

export const applicationRoundKey = (applicationId: string): string =>
  `app:${applicationId}`;

export const treatmentRoundKey = (planId: string, day: string): string =>
  `trt:${planId}:${day}`;

const APP_KEY = /^app:([^:]+)$/;
const TRT_KEY = /^trt:([^:]+):(\d{4}-\d{2}-\d{2})$/;

/** `null` for anything that is not a round key — the caller turns that into a 404. */
export function parseRoundKey(key: string): RoundKeyParts | null {
  const app = APP_KEY.exec(key);
  if (app) return { type: 'APPLICATION', applicationId: app[1] };
  const trt = TRT_KEY.exec(key);
  if (trt) return { type: 'TREATMENT', planId: trt[1], day: trt[2] };
  return null;
}

/** done / skipped by status; `inactive` = an open step whose animal left the herd or whose case / enrollment is no longer
 * running (it is neither due nor late); otherwise the farm-day distance to the due date. */
export type CellState =
  | 'done'
  | 'skipped'
  | 'inactive'
  | 'overdue'
  | 'today'
  | 'upcoming';

const OPEN_STATUSES = new Set(['PENDING', 'RESCHEDULED', 'OVERDUE']);

export interface RoundTaskFact {
  id: string;
  /** The run the step belongs to (case id or enrollment id). */
  runKey: string;
  stepNumber: number | null;
  title: string;
  status: string;
  dueDateTime: Date;
  completedAt: Date | null;
  /** Animal still in the herd and the run still open — only then does an open step count as due / overdue. */
  live: boolean;
}

/** `days` is `due − today` in whole farm days (negative = late). */
export function cellState(
  task: Pick<RoundTaskFact, 'status' | 'dueDateTime' | 'live'>,
  timezone: string,
  now: Date,
): { state: CellState; days: number } {
  const days = farmDaysUntil(task.dueDateTime, timezone, now);
  if (task.status === 'COMPLETED') return { state: 'done', days };
  if (task.status === 'SKIPPED') return { state: 'skipped', days };
  // A MISSED step is closed history, not work to do.
  if (!OPEN_STATUSES.has(task.status) || !task.live) {
    return { state: 'inactive', days };
  }
  if (days < 0 || task.status === 'OVERDUE')
    return { state: 'overdue', days: Math.min(days, -1) };
  return { state: days === 0 ? 'today' : 'upcoming', days };
}

export const isDueState = (state: CellState): boolean =>
  state === 'overdue' || state === 'today';

export interface RoundSummary {
  /** Steps that are not skipped. */
  stepsTotal: number;
  stepsDone: number;
  stepsSkipped: number;
  stepsOverdue: number;
  stepsDueToday: number;
  /** Farm-local `YYYY-MM-DD` of the earliest live open step, or `null`. */
  nextDueDate: string | null;
  status: 'RUNNING' | 'FINISHED';
}

/**
 * The numbers on a round card. Overdue / due-today are counted with `cellState`, so a card's counts are exactly the
 * number of red / amber cells in the same round's grid.
 */
export function summarizeRound(
  tasks: RoundTaskFact[],
  timezone: string,
  now: Date,
  dayOf: (due: Date) => string,
): RoundSummary {
  let stepsDone = 0;
  let stepsSkipped = 0;
  let stepsOverdue = 0;
  let stepsDueToday = 0;
  let next: Date | null = null;
  let running = false;
  for (const task of tasks) {
    if (task.status === 'SKIPPED') {
      stepsSkipped += 1;
      continue;
    }
    if (task.status === 'COMPLETED') stepsDone += 1;
    const { state } = cellState(task, timezone, now);
    if (state === 'overdue') stepsOverdue += 1;
    if (state === 'today') stepsDueToday += 1;
    if (OPEN_STATUSES.has(task.status) && task.live) {
      running = true;
      if (!next || task.dueDateTime < next) next = task.dueDateTime;
    }
  }
  return {
    stepsTotal: tasks.length - stepsSkipped,
    stepsDone,
    stepsSkipped,
    stepsOverdue,
    stepsDueToday,
    nextDueDate: next ? dayOf(next) : null,
    status: running ? 'RUNNING' : 'FINISHED',
  };
}

export interface GridStepFact {
  dayNumber: number;
  title: string;
}

export interface GridRunFact {
  runKey: string;
  runType: 'CASE' | 'ENROLLMENT';
  healthCaseId: string | null;
  planEnrollmentId: string | null;
  caseCode: string | null;
  cattle: { id: string; name: string | null; tagNumber: string };
}

export interface GridColumn {
  key: string;
  /** 1-based position in the protocol; `null` for a step that matches none of the protocol's steps. */
  stepNumber: number | null;
  dayNumber: number | null;
  title: string;
}

export interface GridCell {
  taskId: string;
  state: CellState;
  days: number;
  title: string;
  status: string;
  stepNumber: number | null;
  dueDate: Date;
  doneAt: Date | null;
}

export interface GridRow extends GridRunFact {
  cells: Record<string, GridCell>;
  dueCount: number;
  overdueCount: number;
}

/**
 * The cow × step grid of one round. Columns come from the protocol's own steps ordered by day and are matched to a task
 * through `stepNumber`; a task that matches no step gets an extra column keyed by title instead of being dropped (same
 * rule as the frontend model of RFE-144). Every run is a row, even one with no steps yet. Rows are most urgent first:
 * late animals, then animals with something due today, then by name.
 */
export function buildRoundGrid(
  runs: GridRunFact[],
  tasks: RoundTaskFact[],
  steps: GridStepFact[],
  timezone: string,
  now: Date,
): { columns: GridColumn[]; rows: GridRow[] } {
  const ordered = [...steps].sort((a, b) => a.dayNumber - b.dayNumber);
  const columns: GridColumn[] = ordered.map((step, i) => ({
    key: `s${i + 1}`,
    stepNumber: i + 1,
    dayNumber: step.dayNumber,
    title: step.title,
  }));
  const columnOf = (task: RoundTaskFact): string => {
    if (
      task.stepNumber != null &&
      task.stepNumber >= 1 &&
      task.stepNumber <= ordered.length
    ) {
      return `s${task.stepNumber}`;
    }
    const key = `x:${task.title}`;
    if (!columns.some((c) => c.key === key)) {
      columns.push({
        key,
        stepNumber: null,
        dayNumber: null,
        title: task.title,
      });
    }
    return key;
  };

  const rows = new Map<string, GridRow>(
    runs.map((run) => [
      run.runKey,
      { ...run, cells: {}, dueCount: 0, overdueCount: 0 },
    ]),
  );
  for (const task of tasks) {
    const row = rows.get(task.runKey);
    if (!row) continue;
    const { state, days } = cellState(task, timezone, now);
    row.cells[columnOf(task)] = {
      taskId: task.id,
      state,
      days,
      title: task.title,
      status: task.status,
      stepNumber: task.stepNumber,
      dueDate: task.dueDateTime,
      doneAt: task.completedAt,
    };
    if (isDueState(state)) row.dueCount += 1;
    if (state === 'overdue') row.overdueCount += 1;
  }

  const label = (row: GridRow) => row.cattle.name ?? row.cattle.tagNumber;
  return {
    columns,
    rows: [...rows.values()].sort(
      (a, b) =>
        b.overdueCount - a.overdueCount ||
        b.dueCount - a.dueCount ||
        label(a).localeCompare(label(b)) ||
        a.runKey.localeCompare(b.runKey),
    ),
  };
}
