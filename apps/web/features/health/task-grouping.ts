import { format } from "date-fns";
import type { HealthActionType, HealthPlanKind, HealthTask, MedicineRoute } from "./types";

/** `YYYY-MM-DD` of an ISO instant on the **browser-local** calendar (the farm's day for a Bangladesh user) — the one
 * day key the Schedule tab uses for grouping, the calendar cells and the `?date=` deep link. `iso.slice(0, 10)` is
 * the UTC date, which is the previous day for a step due before 06:00 local. */
export function dayKeyOf(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

/**
 * Figma's "Scheduled Task Card" (734:40931, node 734:41139 etc.) shows one card per *treatment
 * plan* with an aggregate "X/7 Animal" progress bar — but `HealthTask` (`health.controller.ts#getTasks`)
 * is one row per (cattleId, healthCaseId): the backend has no multi-animal "batch task" record at
 * all. This groups real individual task rows that share the same title/type/medicine/due-date into
 * one card, so the aggregate progress shown is a real derived count over real rows, not a fabricated
 * number — same honest-aggregation approach as `avatar-tint.ts`/`task-hub` precedents elsewhere in
 * this codebase (flag gaps, don't fake). `SKIPPED` tasks are excluded (Figma has no state for them).
 */
export interface ScheduledTaskGroup {
  key: string;
  title: string;
  taskType: HealthActionType;
  medicineName: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  route: MedicineRoute | null;
  instruction: string | null;
  /** Shared due date for the group (day-level) — individual tasks may differ by time-of-day. */
  dueDateTime: string;
  tasks: HealthTask[];
}

export function groupScheduledTasks(tasks: HealthTask[]): ScheduledTaskGroup[] {
  const map = new Map<string, ScheduledTaskGroup>();
  for (const task of tasks) {
    if (task.status === "SKIPPED") continue;
    const dateKey = dayKeyOf(task.dueDateTime);
    const key = `${task.title}|${task.taskType}|${task.medicineName ?? ""}|${dateKey}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        title: task.title,
        taskType: task.taskType,
        medicineName: task.medicineName,
        doseAmount: task.doseAmount,
        doseUnit: task.doseUnit,
        route: task.route,
        instruction: task.instruction,
        dueDateTime: task.dueDateTime,
        tasks: [],
      };
      map.set(key, group);
    }
    group.tasks.push(task);
  }
  return [...map.values()].sort((a, b) => a.dueDateTime.localeCompare(b.dueDateTime));
}

export function groupCompletedCount(group: ScheduledTaskGroup): number {
  return group.tasks.filter((t) => t.status === "COMPLETED").length;
}

export function groupIncompleteTasks(group: ScheduledTaskGroup): HealthTask[] {
  return group.tasks.filter((t) => t.status !== "COMPLETED");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole-day difference (`due - today`), so "Today"/"Yesterday"/"Tomorrow" match calendar days,
 * not 24h windows. */
export function daysFromToday(dueDateTime: string, now: Date = new Date()): number {
  const due = startOfDay(new Date(dueDateTime));
  const today = startOfDay(now);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Automatic notice leads for health steps (Notifications v2, `EPIC_NOTIFICATIONS_V2.md` §1 item 8; the backend's
 * `HealthStepSourceResolver` is the source of truth): a preventive round notifies 7 days and 1 day before and on the
 * day; a curative (treatment) step on the day only. Earliest first. */
export const PREVENTIVE_NOTICE_DAYS: readonly number[] = [7, 1, 0];
export const CURATIVE_NOTICE_DAYS: readonly number[] = [0];

/** Treatment protocols are curative; prevention and fertility-care protocols are rounds. No kind = a round. */
export function noticeDaysFor(kind?: HealthPlanKind): readonly number[] {
  return kind === "TREATMENT" ? CURATIVE_NOTICE_DAYS : PREVENTIVE_NOTICE_DAYS;
}

export interface ReminderSlot {
  daysBefore: number;
  /** Local midnight of the day the reminder goes out. */
  date: Date;
  /** `false` once that day has passed — the backend never back-fills a stage, so it was (or will be) skipped. */
  willFire: boolean;
}

/** The four reminder days for a step due `dueDateTime`, each marked as still to come or already skipped. RFE-136's
 * apply preview reads this for its "we'll remind you…" line. */
export function reminderSchedule(dueDateTime: string, now: Date = new Date(), noticeDays: readonly number[] = PREVENTIVE_NOTICE_DAYS): ReminderSlot[] {
  const due = startOfDay(new Date(dueDateTime));
  const today = startOfDay(now);
  return noticeDays.map((daysBefore) => {
    const date = new Date(due.getFullYear(), due.getMonth(), due.getDate() - daysBefore);
    return { daysBefore, date, willFire: date.getTime() >= today.getTime() };
  });
}

/** The next reminder still to come (today counts), or `null` once the due day has passed — from then on the
 * backend sends a daily overdue reminder instead. */
export function nextReminder(dueDateTime: string, now: Date = new Date(), noticeDays: readonly number[] = PREVENTIVE_NOTICE_DAYS): ReminderSlot | null {
  return reminderSchedule(dueDateTime, now, noticeDays).find((slot) => slot.willFire) ?? null;
}

export function isGroupOverdue(group: ScheduledTaskGroup): boolean {
  return daysFromToday(group.dueDateTime) < 0 && groupCompletedCount(group) < group.tasks.length;
}

/** Category chip mapping — real `taskType` (`HealthActionType`) to the Figma mock's 3 chip colors.
 * There is no "Breeding" `HealthActionType` at all (breeding tasks live in the Reproduction module,
 * out of scope here) — `OBSERVATION`/`OTHER` fall back to a neutral `muted` chip rather than
 * fabricating a Breeding label for data that was never bred-related. */
export function taskCategoryChip(taskType: HealthActionType): { variant: "info" | "indigo" | "muted"; labelKey: "medical" | "prevention" | "general" } {
  if (taskType === "VACCINATION" || taskType === "DEWORMING") return { variant: "indigo", labelKey: "prevention" };
  if (taskType === "MEDICINE" || taskType === "LAB_TEST" || taskType === "CHECKUP") return { variant: "info", labelKey: "medical" };
  return { variant: "muted", labelKey: "general" };
}
