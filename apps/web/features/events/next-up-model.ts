import { addDaysLocalIso } from "@/lib/local-date";
import type { UpcomingEvent, UpcomingEventKind } from "@/features/cattle/types";
import type { EventKey } from "./types";

/**
 * RFE-160 — what the "Next up" strip can offer for one upcoming event (03 §3.2):
 *  - **Record** opens the matching event form (the server completes the reminder when the event is recorded, so the
 *    client never completes it itself);
 *  - **Snooze / Skip** move or cancel a Task Hub task, so they exist only for rows whose `ref.type` is `TASK`;
 *  - information-only rows (a withdrawal ending) have no buttons.
 */
export const KIND_TO_RECORD: Partial<Record<UpcomingEventKind, EventKey>> = {
  PREGNANCY_CHECK: "PREG_CHECK",
  DRY_OFF: "DRY_OFF",
  CALVING: "CALVING",
  HEALTH_STEP: "TREATMENT",
  PREVENTIVE_STEP: "VACCINATION",
  WEANING: "WEAN",
};

export function recordKeyFor(event: Pick<UpcomingEvent, "kind" | "actionable">): EventKey | null {
  return event.actionable ? (KIND_TO_RECORD[event.kind] ?? null) : null;
}

export function canSnoozeSkip(event: Pick<UpcomingEvent, "actionable" | "ref">): boolean {
  return event.actionable && event.ref.type === "TASK";
}

export function hasActions(event: UpcomingEvent): boolean {
  return recordKeyFor(event) !== null || canSnoozeSkip(event);
}

export const SNOOZE_DAYS = [1, 3, 7] as const;

/** The task keeps its time of day; only the day moves ("snooze 1 day" = tomorrow, counted from today, not from the old due day). */
export function snoozeDueAt(originalDueAt: string, newDay: string): string {
  const original = new Date(originalDueAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = Number.isNaN(original.getTime()) ? "08:00:00" : `${pad(original.getHours())}:${pad(original.getMinutes())}:00`;
  return new Date(`${newDay}T${time}`).toISOString();
}

export function snoozeDay(today: string, days: number): string {
  return addDaysLocalIso(today, days);
}
