/**
 * Pure period utilities for Reports v2 (RPT-02). Produces the approved `ReportPeriod`:
 * `[start, end)` UTC instants of farm-local midnights, inclusive farm-local `startDate`/`endDate`.
 * Timezone math is delegated to `farmDayStart`/`farmDayEnd` (health domain, pure) and `localDateIso`/
 * `isValidTimezone` (common farm-time). Civil-date arithmetic lives in `ymd.ts`.
 */
import {
  isValidTimezone,
  localDateIso,
} from '../../../../common/farm-time/farm-time';
import {
  farmDayEnd,
  farmDayStart,
} from '../../../health/domain/health-farm-day';
import type { DatePreset, ReportType } from '../contracts/enums';
import type { ReportPeriod } from '../contracts/period';
import {
  InvalidPresetError,
  InvalidRangeError,
  InvalidTimezoneError,
  PeriodKindMismatchError,
  RangeTooLongError,
} from './errors';
import {
  addDaysYmd,
  assertYmd,
  daysInMonth,
  diffDaysYmd,
  enumerateYmd,
  isoWeekOf,
  isoWeekday,
  makeYmd,
  mondayOf,
  parseYmd,
} from './ymd';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Maximum inclusive span of a custom range, in days. */
export const MAX_CUSTOM_RANGE_DAYS = 366;

export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface CustomRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

function assertTimezone(timezone: string): void {
  if (!timezone || !isValidTimezone(timezone)) {
    throw new InvalidTimezoneError(timezone);
  }
}

function build(
  startDate: string,
  endDate: string,
  timezone: string,
  label: string,
): ReportPeriod {
  return {
    start: farmDayStart(startDate, timezone).toISOString(),
    end: farmDayEnd(endDate, timezone).toISOString(),
    startDate,
    endDate,
    timezone,
    label,
  };
}

const weekLabel = (monday: string): string => {
  const { year, week } = isoWeekOf(monday);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

function weekPeriod(monday: string, timezone: string): ReportPeriod {
  return build(monday, addDaysYmd(monday, 6), timezone, weekLabel(monday));
}

function monthPeriod(y: number, m: number, timezone: string): ReportPeriod {
  return build(
    makeYmd(y, m, 1),
    makeYmd(y, m, daysInMonth(y, m)),
    timezone,
    `${MONTHS[m - 1]} ${y}`,
  );
}

function yearPeriod(y: number, timezone: string): ReportPeriod {
  return build(`${y}-01-01`, `${y}-12-31`, timezone, String(y));
}

/**
 * Resolve a preset against `nowInstant` in the farm timezone. `this_week` is the full Mon-Sun week containing
 * today (not truncated at today); likewise month and year. Throws `PeriodError` subclasses on bad input.
 */
export function resolvePreset(
  preset: DatePreset,
  nowInstant: Date,
  timezone: string,
  custom?: CustomRange,
): ReportPeriod {
  assertTimezone(timezone);
  const today = localDateIso(timezone, nowInstant);
  switch (preset) {
    case 'today':
      return build(today, today, timezone, today);
    case 'this_week':
      return weekPeriod(mondayOf(today), timezone);
    case 'this_month': {
      const { y, m } = parseYmd(today);
      return monthPeriod(y, m, timezone);
    }
    case 'this_year':
      return yearPeriod(parseYmd(today).y, timezone);
    case 'custom': {
      if (!custom) throw new InvalidPresetError('custom preset needs from/to');
      const from = assertYmd(custom.from);
      const to = assertYmd(custom.to);
      if (from > to) throw new InvalidRangeError(from, to);
      const span = diffDaysYmd(from, to) + 1;
      if (span > MAX_CUSTOM_RANGE_DAYS)
        throw new RangeTooLongError(span, MAX_CUSTOM_RANGE_DAYS);
      return build(from, to, timezone, from === to ? from : `${from} - ${to}`);
    }
    default:
      throw new InvalidPresetError(`Unknown preset: ${String(preset)}`);
  }
}

/** Most recent fully closed Mon-Sun week / calendar month in farm-local time. */
export function closedPeriodFor(
  type: Extract<ReportType, 'WEEKLY' | 'MONTHLY'>,
  nowInstant: Date,
  timezone: string,
): ReportPeriod {
  assertTimezone(timezone);
  const today = localDateIso(timezone, nowInstant);
  if (type === 'WEEKLY') {
    return weekPeriod(addDaysYmd(mondayOf(today), -7), timezone);
  }
  if (type === 'MONTHLY') {
    const { y, m } = parseYmd(today);
    return m === 1
      ? monthPeriod(y - 1, 12, timezone)
      : monthPeriod(y, m - 1, timezone);
  }
  throw new InvalidPresetError(`No closed period for type: ${String(type)}`);
}

/** Classify a period by shape. A custom range that is exactly a calendar week/month/year is treated as that kind. */
export function detectPeriodKind(period: ReportPeriod): PeriodKind {
  const { startDate: s, endDate: e } = period;
  if (s === e) return 'day';
  const a = parseYmd(s);
  const b = parseYmd(e);
  if (a.y === b.y && a.m === 1 && a.d === 1 && b.m === 12 && b.d === 31) {
    return 'year';
  }
  if (
    a.y === b.y &&
    a.m === b.m &&
    a.d === 1 &&
    b.d === daysInMonth(b.y, b.m)
  ) {
    return 'month';
  }
  if (isoWeekday(s) === 1 && diffDaysYmd(s, e) === 6) return 'week';
  return 'custom';
}

export interface PreviousPeriodResult {
  /** The comparison period. When `partial`, it is truncated to the same elapsed span as `current`. */
  previous: ReportPeriod;
  /** True when the current week/month/year is still in progress, so a like-for-like span is compared. */
  partial: boolean;
  /**
   * The current period to compare. Equals the input when not partial; when partial it is truncated at today
   * (inclusive). Use this (not the full period) against `previous` for the delta.
   */
  current: ReportPeriod;
  kind: PeriodKind;
}

/**
 * Previous equivalent period. day -> yesterday; week -> previous Mon-Sun; month -> previous calendar month
 * (month length / leap year / Jan->Dec handled); year -> previous year; custom -> same-length window right
 * before. For an in-progress week/month/year (today inside the period) the result is `partial: true` and both
 * `current` and `previous` cover the same number of elapsed days (previous is capped at its own length, e.g.
 * 31 Mar elapsed vs February). Day and custom are never truncated.
 * `kind` may be passed to override shape detection.
 */
export function previousEquivalentPeriod(
  period: ReportPeriod,
  nowInstant: Date,
  kind: PeriodKind = detectPeriodKind(period),
): PreviousPeriodResult {
  const tz = period.timezone;
  assertTimezone(tz);
  const { startDate: s, endDate: e } = period;
  const len = diffDaysYmd(s, e) + 1;
  const detected = detectPeriodKind(period);
  // 'custom' is always allowed (same-length window); calendar kinds must match the shape.
  if (kind !== 'custom' && kind !== detected) {
    throw new PeriodKindMismatchError(kind, detected);
  }
  let full: ReportPeriod;
  switch (kind) {
    case 'day':
      full = build(addDaysYmd(s, -1), addDaysYmd(s, -1), tz, addDaysYmd(s, -1));
      break;
    case 'week':
      full = weekPeriod(addDaysYmd(s, -7), tz);
      break;
    case 'month': {
      const { y, m } = parseYmd(s);
      full = m === 1 ? monthPeriod(y - 1, 12, tz) : monthPeriod(y, m - 1, tz);
      break;
    }
    case 'year':
      full = yearPeriod(parseYmd(s).y - 1, tz);
      break;
    default: {
      const ps = addDaysYmd(s, -len);
      const pe = addDaysYmd(s, -1);
      full = build(ps, pe, tz, ps === pe ? ps : `${ps} - ${pe}`);
    }
  }

  const today = localDateIso(tz, nowInstant);
  const truncatable = kind === 'week' || kind === 'month' || kind === 'year';
  const inProgress = truncatable && today >= s && today <= e;
  if (!inProgress) {
    return { previous: full, partial: false, current: period, kind };
  }

  const elapsed = diffDaysYmd(s, today) + 1;
  const prevEnd = addDaysYmd(full.startDate, elapsed - 1);
  const cappedEnd = prevEnd > full.endDate ? full.endDate : prevEnd;
  return {
    previous: build(full.startDate, cappedEnd, tz, `${full.label} (to date)`),
    partial: true,
    current: build(s, today, tz, `${period.label} (to date)`),
    kind,
  };
}

/**
 * The instant a scheduled report for `period` becomes due: 00:00 farm-local on the day AFTER the period ends
 * (DST-correct, via `farmDayStart`).
 */
export function scheduledRunInstant(
  period: ReportPeriod,
  timezone: string,
): Date {
  assertTimezone(timezone);
  return farmDayStart(addDaysYmd(period.endDate, 1), timezone);
}

/** Every farm-local day (`YYYY-MM-DD`) of the period, inclusive, in order. For coverage counts. */
export function enumerateDays(period: ReportPeriod): string[] {
  return enumerateYmd(period.startDate, period.endDate);
}
