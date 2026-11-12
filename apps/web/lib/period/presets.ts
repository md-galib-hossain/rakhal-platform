import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";

/** Half-open date range: `[from, to)` — matches the backend's own `PeriodRange`
 * (`rakhal-backend/src/common/finance/period.ts`). */
export interface PeriodRange {
  from: Date;
  to: Date;
}

/** RAKHAL-380 (MILESTONE 22, `BUSINESS_IA_PRD.md` §4.4, §6.1, §6.2). The Reports/
 * Overview date-range preset set every finance screen shares. `"custom"` has no
 * derivable range of its own — it is the *result* of a `DateRangePicker` selection,
 * never passed to {@link presetToRange}. */
export type PeriodPreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

/** Every selectable preset in display order, `"custom"` last (it renders as the
 * calendar trigger itself, not a list row). */
export const PERIOD_PRESET_VALUES: PeriodPreset[] = [
  "today",
  "this_week",
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "custom",
];

/** Derives the `[from, to)` range for every preset except `"custom"` — `to` is
 * always "now" for an open-ended preset (Today/This Week/This Month/This
 * Quarter/This Year), never the far end of the calendar unit, so a mid-month
 * query never includes future dates. `"last_month"` is the one bounded preset:
 * a full past calendar month. */
export function presetToRange(preset: Exclude<PeriodPreset, "custom">, now = new Date()): PeriodRange {
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "this_quarter":
      return { from: startOfQuarter(now), to: endOfDay(now) };
    case "this_year":
      return { from: startOfYear(now), to: endOfDay(now) };
  }
}

/**
 * Previous-period derivation — **mirrors the backend's own
 * `derivePreviousPeriod`** (`rakhal-backend/src/common/finance/period.ts`)
 * exactly: one formula for both an explicit custom range and a named preset,
 * `prev = [from − duration, from − 1ms]`, a same-length slice of the prior
 * window rather than a full prior calendar unit (Aug 1–25 → Jul 1–25, never
 * the full July). Used here **only to format the comparison label on the
 * client** ("vs Jul 1 – 25") — the actual previous-period numbers always come
 * from the server, which runs the identical formula; this function must never
 * drift from that one.
 */
export function derivePreviousPeriod(period: PeriodRange): PeriodRange {
  const durationMs = period.to.getTime() - period.from.getTime();
  return {
    from: new Date(period.from.getTime() - durationMs),
    to: new Date(period.from.getTime() - 1),
  };
}

/** Deterministic cache-key fragment for a period-scoped `qk` entry — pass the
 * result as that entry's `period` argument. Encodes both bounds so two
 * differently-sized ranges sharing a `from` never collide in the query cache. */
export function toPeriodKey(range: PeriodRange): string {
  return `${range.from.toISOString()}_${range.to.toISOString()}`;
}
