import type { MetricId } from './metric-definition';

/**
 * A metric result is ALWAYS one of four explicit states. Missing data is never representable as 0:
 * a genuine zero is `{ state: 'value', value: 0 }`.
 */
export type MetricValue =
  | { state: 'value'; value: number; unit: string }
  | { state: 'missing'; reason: string } // data should exist but was not recorded
  | { state: 'not_calculated'; reason: string } // skipped (e.g. incomplete data for decline)
  | { state: 'not_applicable' }; // metric does not apply to this scope

export const valueOf = (value: number, unit: string): MetricValue => ({
  state: 'value',
  value,
  unit,
});

export interface Comparison {
  current: MetricValue;
  previous: MetricValue;
  /** current - previous; null unless BOTH are `value`. */
  absoluteChange: number | null;
  /** null when previous is 0 or not a `value`, or current is not a `value`. */
  percentChange: number | null;
  previousState: MetricValue['state'];
}

/** One point of a time series (e.g. a farm-local day). A missing day is `missing`, never 0. */
export interface SeriesPoint {
  /** Stable key, e.g. a YYYY-MM-DD date. */
  key: string;
  value: MetricValue;
}

/** One row of a per-entity breakdown (cow, feed item, category). */
export interface BreakdownRow {
  /** Stable key, e.g. a cattleId or ingredientId. */
  key: string;
  /** Display name when the key is not human readable. */
  label: string | null;
  value: MetricValue;
  /** Same meaning as MetricResult.source. */
  source: string | null;
}

/** One rendered metric. `source` keeps same-named figures distinguishable (see README). */
export interface MetricResult {
  metricId: MetricId;
  value: MetricValue;
  /** e.g. 'offeredMinusRefusal' | 'recordedActual' | 'distributionCost' | 'ledgerFeed5000'. */
  source: string | null;
  comparison: Comparison | null;
  /** Optional time series for charts. Do NOT encode series/rows in the id or `source`. */
  series?: SeriesPoint[];
  /** Optional ordered breakdown (already ranked/capped by the metric module). */
  rows?: BreakdownRow[];
  /** Copied from the definition so the payload can be audited for finance without the registry. */
  requiresPermission: string | null;
}

/** Percent change relative to |previous|. Null on a zero/non-finite denominator: never Infinity or NaN. */
export function safePercentChange(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0)
    return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function compareMetric(
  current: MetricValue,
  previous: MetricValue,
): Comparison {
  const bothValues = current.state === 'value' && previous.state === 'value';
  return {
    current,
    previous,
    absoluteChange: bothValues ? current.value - previous.value : null,
    percentChange: bothValues
      ? safePercentChange(current.value, previous.value)
      : null,
    previousState: previous.state,
  };
}
