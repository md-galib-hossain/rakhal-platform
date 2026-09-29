/**
 * A farm's calendar day, resolved in the farm's own IANA timezone.
 *
 * Day-keyed data (feeding/milk logs, calendars, reports) is stored as the farm's local calendar date at UTC
 * midnight (`2026-09-30` → `2026-09-30T00:00:00Z`). Deriving "today" from the UTC clock is therefore wrong for a
 * UTC+6 farm between midnight and 6 AM local — it still says yesterday. Pure functions, no I/O.
 */

/** Bangladesh — every farm today; the column default, so existing farms need no backfill. */
export const DEFAULT_FARM_TIMEZONE = 'Asia/Dhaka';

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD` — the calendar date it currently is in `timezone`. */
export function localDateIso(
  timezone: string = DEFAULT_FARM_TIMEZONE,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: isValidTimezone(timezone) ? timezone : DEFAULT_FARM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** UTC midnight of a `YYYY-MM-DD` (or any ISO string's calendar date) — the storage key for a farm day. */
export function dayKey(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** The storage key for the farm's current day in `timezone`. */
export function localDayStart(
  timezone: string = DEFAULT_FARM_TIMEZONE,
  now: Date = new Date(),
): Date {
  return dayKey(localDateIso(timezone, now));
}
