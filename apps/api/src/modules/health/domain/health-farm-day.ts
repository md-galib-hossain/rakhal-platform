/**
 * The farm's calendar day as real instants — pure, no I/O (RAKHAL-470). `HealthTask.dueDateTime` is a true instant, but
 * "due today" / "due up to Friday" are questions about the farm's own calendar day, so a day filter has to be cut at
 * the farm's local midnight, not at UTC midnight (which is 06:00 in Dhaka).
 */

/** Milliseconds the wall clock in `timezone` is ahead of UTC at `at` (positive east of Greenwich). */
function offsetMs(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  // `at` has no sub-second part in the formatted wall clock; compare at whole seconds.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the farm's calendar day `ymd` (`YYYY-MM-DD`) begins in `timezone` (its local 00:00). */
export function farmDayStart(ymd: string, timezone: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // Two passes so a day whose offset differs from the one at UTC midnight (a DST change) still lands on local 00:00.
  const first = utcMidnight - offsetMs(timezone, new Date(utcMidnight));
  return new Date(utcMidnight - offsetMs(timezone, new Date(first)));
}

/** The instant the farm day *after* `ymd` begins — an exclusive upper bound for "due up to and including `ymd`". */
export function farmDayEnd(ymd: string, timezone: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return farmDayStart(next, timezone);
}
