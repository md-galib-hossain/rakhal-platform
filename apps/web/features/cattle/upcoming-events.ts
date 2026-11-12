import type { ChipProps } from "@/components/ui/chip";
import type { UpcomingEvent } from "./types";

/** Pure display helpers for the Animals list "Next event" column (RFE-151, MILESTONE 30). The server
 * sends an i18n key + params (`UpcomingEvent.labelKey`), never an English string; these map that to the
 * `cattle` namespace and to the colour/relative-date the cell shows. */

/** The `labelKey` suffixes the backend currently emits (`cattle.upcoming.<suffix>`). An unknown one
 * (a newer backend) falls back to the generic per-kind label rather than printing a raw key. */
const KNOWN_LABELS = new Set([
  "healthStep",
  "preventiveStep",
  "pregnancyCheck",
  "calving",
  "dryOff",
  "task",
  "milkWithdrawalEnd",
  "meatWithdrawalEnd",
]);

export interface I18nRef {
  /** Key inside the `cattle` namespace. */
  key: string;
  values?: Record<string, string | number>;
}

/** Translation key + params for the event's title (e.g. "Pregnancy check", or the step/task name). */
export function eventLabel(event: UpcomingEvent): I18nRef {
  const suffix = event.labelKey.slice(event.labelKey.lastIndexOf(".") + 1);
  if (KNOWN_LABELS.has(suffix)) {
    return { key: `upcoming.labels.${suffix}`, values: event.labelParams };
  }
  return { key: `upcoming.kinds.${event.kind}`, values: event.labelParams };
}

/** "3d overdue" / "Today" / "Tomorrow" / "in 5d" — on the farm's own calendar day (the server's `daysUntil`). */
export function eventDue(event: UpcomingEvent): I18nRef {
  const d = event.daysUntil;
  if (d < 0) return { key: "upcoming.overdueDays", values: { count: -d } };
  if (d === 0) return { key: "upcoming.today" };
  if (d === 1) return { key: "upcoming.tomorrow" };
  return { key: "upcoming.inDays", values: { count: d } };
}

/** Urgency colour only (epic §2): red overdue, amber due soon, neutral later. Information that is not
 * work (a withdrawal ending) never uses the alarm colours. */
export function eventVariant(event: UpcomingEvent): ChipProps["variant"] {
  if (!event.actionable) return "info";
  if (event.urgency === "OVERDUE") return "destructive";
  if (event.urgency === "DUE_SOON") return "warning";
  return "muted";
}
