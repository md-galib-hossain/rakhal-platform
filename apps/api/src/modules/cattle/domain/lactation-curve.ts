/**
 * Cattle Overview tab aggregation helpers (PRD §8.5 Tab1). Pure functions (no
 * Prisma/framework) so they are unit-testable; the service supplies the rows.
 */

export interface DailyYield {
  /** Production day (UTC midnight). */
  date: Date;
  /** Total litres logged across all sessions that day. */
  totalL: number;
}

export interface LactationCurvePoint {
  dim: number;
  yield_l: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

const round = (value: number) => Math.round(value * 100) / 100;

/** Whole days between two dates (>= 0). */
export function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
}

/**
 * Map a lactation's daily yields onto its DIM axis (PRD §8.5 lactation curve).
 * DIM = day in milk = days since the lactation start. Days before the start are
 * dropped; points are returned in ascending DIM order.
 */
export function buildLactationCurve(
  lactationStart: Date,
  dailyYields: DailyYield[],
): LactationCurvePoint[] {
  return dailyYields
    .filter((d) => d.date.getTime() >= lactationStart.getTime())
    .map((d) => ({
      dim: daysBetween(lactationStart, d.date),
      yield_l: round(d.totalL),
    }))
    .sort((a, b) => a.dim - b.dim);
}

/**
 * Percentage change of `current` vs `previous`. Returns `null` when there is no
 * prior basis to compare against (so the UI can hide the trend).
 */
export function trendPct(current: number, previous: number): number | null {
  if (!previous) {
    return current ? 100 : null;
  }
  return round(((current - previous) / previous) * 100);
}
