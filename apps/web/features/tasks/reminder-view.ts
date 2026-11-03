import type { Task, TaskListFilters } from "./types";

/** Task Hub top-level segment (URL `?segment=`). Tasks is the default and carries no param. */
export type TaskHubView = "tasks" | "reminders";

/** Query param name. Not `view`: the animal workspace overlay reads `?view=<cattleId>` and would show "Animal not found". */
export const SEGMENT_PARAM = "segment";

export function parseView(raw: string | null | undefined): TaskHubView {
  return raw === "reminders" ? "reminders" : "tasks";
}

export type ReminderTab = "upcoming" | "overdue" | "repeating" | "done";
export const REMINDER_TABS: ReminderTab[] = ["upcoming", "overdue", "repeating", "done"];

/** Statuses that are still live (not finished or abandoned). */
export const OPEN_STATUSES = "PENDING,IN_PROGRESS,BLOCKED";
/** The Done tab shows finished and cancelled reminders (the status chip tells them apart). */
export const DONE_STATUSES = "COMPLETED,CANCELLED";

/**
 * Reminder tab -> `GET /tasks` query. Every tab is an exact server filter with no client clock (the server
 * decides "now"): Upcoming = `filter=upcoming` (open, due from now), Overdue = `filter=overdue` (its exact
 * complement), Repeating = open + `recurring=true`, Done = `status=COMPLETED,CANCELLED`.
 * Sort (by due date): Upcoming soonest first, Overdue longest-overdue first (most urgent on top),
 * Repeating soonest first, Done newest first (the just-finished ones are what people look for).
 */
export function reminderServerFilters(tab: ReminderTab): Pick<TaskListFilters, "kind" | "filter" | "status" | "recurring" | "sortOrder"> {
  switch (tab) {
    case "overdue":
      return { kind: "reminder", filter: "overdue", sortOrder: "asc" };
    case "upcoming":
      return { kind: "reminder", filter: "upcoming", sortOrder: "asc" };
    case "repeating":
      return { kind: "reminder", status: OPEN_STATUSES, recurring: true, sortOrder: "asc" };
    case "done":
      return { kind: "reminder", status: DONE_STATUSES, sortOrder: "desc" };
  }
}

export type ListPhase = "error" | "loading" | "empty" | "list";

/** What the list area shows. A failed first page is an error with retry (never a skeleton); a failed
 * later page keeps the loaded rows (the footer owns that retry). */
export function listPhase(s: { isError: boolean; isLoading: boolean; itemCount: number; isNextPageError?: boolean }): ListPhase {
  if (s.isError || (s.isNextPageError && s.itemCount === 0)) return "error";
  if (s.isLoading) return "loading";
  return s.itemCount === 0 ? "empty" : "list";
}

export type ReminderRepeat = { type: "everyN"; n: number } | { type: "weekly" } | { type: "monthly" } | null;

export function reminderRepeat(task: Pick<Task, "recurring" | "recurrenceType" | "recurrenceIntervalDays">): ReminderRepeat {
  if (!task.recurring) return null;
  if (task.recurrenceType === "WEEKLY") return { type: "weekly" };
  if (task.recurrenceType === "MONTHLY") return { type: "monthly" };
  if (task.recurrenceType === "DAILY") return { type: "everyN", n: 1 };
  return { type: "everyN", n: task.recurrenceIntervalDays ?? 1 };
}

export type ReminderAudienceSummary =
  | { type: "roles"; roles: string[] }
  | { type: "people"; count: number }
  | { type: "assignee"; name: string | null };

/** Who is told: named people win, then roles, else the assignee. */
export function reminderAudience(task: Pick<Task, "recipientUserIds" | "notifyRoleNames" | "assignedTo">): ReminderAudienceSummary {
  const people = task.recipientUserIds ?? [];
  if (people.length > 0) return { type: "people", count: people.length };
  const roles = task.notifyRoleNames ?? [];
  if (roles.length > 0) return { type: "roles", roles };
  return { type: "assignee", name: task.assignedTo?.name ?? null };
}
