import { format } from "date-fns";

/**
 * "Today" / "this month" / "now" in the browser's LOCAL timezone.
 *
 * `new Date().toISOString().slice(...)` is UTC, so for a farm in UTC+6 it reports yesterday until 6 AM local.
 * These match what `DatePicker` / `DateTimePicker` emit (date-fns local formatting), so a defaulted date and a
 * picked date always agree.
 */

/** `YYYY-MM-DD` */
export function todayLocalIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** `YYYY-MM` */
export function currentMonthLocalIso(): string {
  return format(new Date(), "yyyy-MM");
}

/** `YYYY-MM-DDTHH:mm` — the shape `datetime-local` / `DateTimePicker` values use. */
export function nowLocalDateTimeIso(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

/** `dateStr` (`YYYY-MM-DD`) shifted by `days`, as `YYYY-MM-DD`, computed on local calendar days. */
export function addDaysLocalIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}
