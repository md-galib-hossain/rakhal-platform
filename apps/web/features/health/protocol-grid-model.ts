import { daysFromToday, groupScheduledTasks, type ScheduledTaskGroup } from "./task-grouping";
import type { HealthPlanStep, HealthTask } from "./types";

/** RFE-144 — the cow × step grid in the protocol sheet, as plain data (the component only draws it). One row per run
 * (a case or an enrollment, so the same cow on two runs of a protocol is two rows), one column per protocol step, one
 * cell per task. */

/** `inactive` is only ever produced by the rounds API (an open step whose animal left the herd or whose run stopped);
 * this file's own `cellState` never returns it. */
export type CellState = "done" | "skipped" | "inactive" | "overdue" | "today" | "upcoming";

/** A cell is *due* when it still has to be done today or is late — the states the sheet's banner and filter count. */
export const isDueState = (state: CellState): boolean => state === "overdue" || state === "today";

export interface GridCell {
  task: HealthTask;
  state: CellState;
  /** `due - today` in whole days (negative = late). */
  days: number;
}

export interface GridColumn {
  key: string;
  /** 1-based position in the protocol; `null` for a task that matches no step of the protocol. */
  stepNumber: number | null;
  dayNumber: number | null;
  title: string;
}

export interface GridRow {
  key: string;
  cattleId: string;
  label: string;
  tagNumber: string;
  healthCaseId: string | null;
  planEnrollmentId: string | null;
  cells: Record<string, GridCell>;
  dueCount: number;
  overdueCount: number;
}

export interface ProtocolGrid {
  columns: GridColumn[];
  rows: GridRow[];
  dueCount: number;
  overdueCount: number;
}

/** done / skipped by status, otherwise by the due day against today (a `MISSED` step is late too). */
export function cellState(task: HealthTask, now: Date = new Date()): { state: CellState; days: number } {
  const days = daysFromToday(task.dueDateTime, now);
  if (task.status === "COMPLETED") return { state: "done", days };
  if (task.status === "SKIPPED") return { state: "skipped", days };
  if (days < 0 || task.status === "OVERDUE" || task.status === "MISSED") return { state: "overdue", days: Math.min(days, -1) };
  return { state: days === 0 ? "today" : "upcoming", days };
}

const runKey = (task: HealthTask): string => task.healthCaseId ?? task.planEnrollmentId ?? task.cattleId;

/**
 * Build the grid from every task of one protocol. Columns come from the protocol's own steps (by day), matched to a
 * task through `stepNumber`; a task that matches no step gets an extra column of its own (keyed by title) rather than
 * being dropped. Rows are ordered most urgent first: late cows, then cows with something due today, then by name.
 */
export function buildProtocolGrid(tasks: HealthTask[], steps: HealthPlanStep[], now: Date = new Date()): ProtocolGrid {
  const ordered = [...steps].sort((a, b) => a.dayNumber - b.dayNumber);
  const columns: GridColumn[] = ordered.map((step, i) => ({ key: `s${i + 1}`, stepNumber: i + 1, dayNumber: step.dayNumber, title: step.title }));
  const columnOf = (task: HealthTask): string => {
    if (task.stepNumber != null && task.stepNumber >= 1 && task.stepNumber <= ordered.length) return `s${task.stepNumber}`;
    const key = `x:${task.title}`;
    if (!columns.some((c) => c.key === key)) columns.push({ key, stepNumber: null, dayNumber: null, title: task.title });
    return key;
  };

  const rows = new Map<string, GridRow>();
  for (const task of tasks) {
    const key = runKey(task);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        cattleId: task.cattleId,
        label: task.cattle?.name ?? task.cattle?.tagNumber ?? task.cattleId,
        tagNumber: task.cattle?.tagNumber ?? "",
        healthCaseId: task.healthCaseId,
        planEnrollmentId: task.planEnrollmentId,
        cells: {},
        dueCount: 0,
        overdueCount: 0,
      };
      rows.set(key, row);
    }
    const { state, days } = cellState(task, now);
    row.cells[columnOf(task)] = { task, state, days };
    if (isDueState(state)) row.dueCount += 1;
    if (state === "overdue") row.overdueCount += 1;
  }

  const list = [...rows.values()].sort((a, b) => b.overdueCount - a.overdueCount || b.dueCount - a.dueCount || a.label.localeCompare(b.label));
  return {
    columns,
    rows: list,
    dueCount: list.reduce((n, r) => n + r.dueCount, 0),
    overdueCount: list.reduce((n, r) => n + r.overdueCount, 0),
  };
}

/** The open tasks of one column that are due today or late — what "Record all due" in the column header covers. */
export function dueTasksOfColumn(grid: ProtocolGrid, columnKey: string): HealthTask[] {
  return grid.rows.flatMap((row) => {
    const cell = row.cells[columnKey];
    return cell && isDueState(cell.state) ? [cell.task] : [];
  });
}

/** One synthetic step group for the existing record / reschedule dialogs from tasks that may have different due days
 * (a column holds a late cow and a due-today cow): the group carries the earliest due date. */
export function groupOfTasks(tasks: HealthTask[]): ScheduledTaskGroup | undefined {
  if (tasks.length === 0) return undefined;
  const [first] = groupScheduledTasks([tasks[0]]);
  if (!first) return undefined;
  const earliest = tasks.reduce((min, t) => (t.dueDateTime < min ? t.dueDateTime : min), tasks[0].dueDateTime);
  return { ...first, key: `col:${tasks.map((t) => t.id).join(",")}`, dueDateTime: earliest, tasks };
}
