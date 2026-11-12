import { format } from "date-fns";

/**
 * Due-date helpers for the plain task forms. The task's `dueAt` is a UTC instant; the farmer thinks in their own
 * clock (Dhaka, UTC+6), so a date shown/typed in a form is the LOCAL calendar day, never `iso.slice(0, 10)`.
 */

/** Local `YYYY-MM-DD` of an instant. */
export function localDateOf(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

/**
 * The `dueAt` to send on edit. Untouched date -> the original string, byte for byte (no re-derivation, so the time of
 * day survives). Changed date -> the new local day at the task's original local time of day.
 */
export function editedDueAt(originalIso: string, pickedDate: string): string {
  if (pickedDate === localDateOf(originalIso)) return originalIso;
  const time = format(new Date(originalIso), "HH:mm:ss");
  return new Date(`${pickedDate}T${time}`).toISOString();
}
