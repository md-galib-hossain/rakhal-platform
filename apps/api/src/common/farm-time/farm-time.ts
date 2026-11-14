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

const MINUTE_MS = 60_000;

/** Offset of `timezone` from UTC at `instantMs`, in ms (local wall clock minus UTC). */
function zoneOffsetMs(timezone: string, instantMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instantMs));
  const n = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    n('year'),
    n('month') - 1,
    n('day'),
    n('hour'),
    n('minute'),
    n('second'),
  );
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The UTC instant at which the wall clock in `timezone` reads `ymd` `hm` (`YYYY-MM-DD`, `HH:mm`).
 * A local time that does not exist (DST gap) moves forward to the first valid minute after the gap; an ambiguous
 * time (DST overlap) takes the first (earlier) occurrence. An invalid timezone falls back to the default.
 */
export function zonedToUtc(
  timezone: string,
  ymd: string,
  hm: string = '00:00',
): Date {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_FARM_TIMEZONE;
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);

  // Offsets a day either side bracket any single transition; try each as the candidate interpretation.
  const before = zoneOffsetMs(tz, wallAsUtc - 24 * 60 * MINUTE_MS);
  const after = zoneOffsetMs(tz, wallAsUtc + 24 * 60 * MINUTE_MS);
  const valid = [...new Set([before, after])]
    .map((offset) => wallAsUtc - offset)
    .filter(
      (candidate) => zoneOffsetMs(tz, candidate) === wallAsUtc - candidate,
    )
    .sort((a, b) => a - b);
  if (valid.length > 0) return new Date(valid[0]);

  // Gap: first minute at which the post-transition offset applies.
  let lo = wallAsUtc - Math.max(before, after) - 24 * 60 * MINUTE_MS;
  let hi = wallAsUtc - Math.min(before, after) + 24 * 60 * MINUTE_MS;
  while (hi - lo > MINUTE_MS) {
    const mid = lo + Math.floor((hi - lo) / MINUTE_MS / 2) * MINUTE_MS;
    if (zoneOffsetMs(tz, mid) === after) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}
