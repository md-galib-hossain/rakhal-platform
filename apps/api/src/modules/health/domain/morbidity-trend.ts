/**
 * Morbidity trend maths (pure, no framework): turns case start dates into a zero-filled series for a window, bucketed
 * so the chart stays readable — daily for a short window, weekly for a season, monthly for a year or "all time".
 * Days are UTC, the same convention as the dashboard's old `groupByDay`.
 */
export type TrendBucket = 'day' | 'week' | 'month';

export interface TrendPoint {
  /** First day of the bucket, `YYYY-MM-DD` (Monday for weeks, the 1st for months). */
  date: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function pickBucket(spanDays: number): TrendBucket {
  if (spanDays <= 60) return 'day';
  if (spanDays <= 200) return 'week';
  return 'month';
}

function bucketKey(date: Date, bucket: TrendBucket): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  if (bucket === 'week') {
    const sinceMonday = (d.getUTCDay() + 6) % 7;
    d.setTime(d.getTime() - sinceMonday * DAY_MS);
  } else if (bucket === 'month') {
    d.setUTCDate(1);
  }
  return d.toISOString().slice(0, 10);
}

/** Counts per bucket from `from` to `to` inclusive; buckets with no cases are present with `count: 0`. */
export function buildTrend(
  dates: Date[],
  from: Date,
  to: Date,
): { bucket: TrendBucket; points: TrendPoint[] } {
  const spanDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1,
  );
  const bucket = pickBucket(spanDays);

  const counts = new Map<string, number>();
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    counts.set(bucketKey(new Date(t), bucket), 0);
  }
  const lastKey = bucketKey(to, bucket);
  if (!counts.has(lastKey)) counts.set(lastKey, 0);

  for (const date of dates) {
    const key = bucketKey(date, bucket);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    bucket,
    points: [...counts.entries()].map(([date, count]) => ({ date, count })),
  };
}
