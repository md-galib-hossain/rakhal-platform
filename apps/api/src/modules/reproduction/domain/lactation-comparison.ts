/**
 * Pure lactation-comparison helpers (RAKHAL-287). No framework/Prisma
 * imports, mirrors the `lactation-yield.ts`/`lactation-persistency.ts`/
 * `lactation-dry-off-projection.ts` precedent in this same directory.
 *
 * Two shapes of comparison:
 * 1. **Cow vs. herself** — current lactation vs. a previous one, aligned by
 *    days-in-milk (DIM), not calendar date. `alignSeriesByDim` is the piece
 *    that actually does this: each `DailyYieldPoint[]` series is already
 *    indexed from its own `dim=0` (`lactation-curve.ts`'s
 *    `buildDailyYieldSeries`), so pairing two series by `dim` — not by
 *    `date` — is what makes "day 1 of lactation A line up with day 1 of
 *    lactation B" true, even though the two lactations started on different
 *    calendar dates.
 * 2. **Farm-level group-by** — bucket a set of active-lactation snapshots by
 *    parity/shed/DIM-range and average their yield/peak/
 *    persistency per bucket.
 */
import { DailyYieldPoint } from './lactation-curve';

/** One paired point per DIM day, `null` on whichever side has no data at that DIM (e.g. one lactation is shorter than the other). */
export interface DimAlignedPoint {
  dim: number;
  currentYieldL: number | null;
  previousYieldL: number | null;
}

/**
 * Pairs two `DailyYieldPoint[]` series (each already DIM-indexed from its own
 * `dim=0`) by `dim`, not by calendar `date` — the DIM-alignment behavior this
 * ticket's AC calls out explicitly. Runs to the longer of the two series;
 * the shorter side reads `null` past its own length rather than being
 * padded/zero-filled (a real "no data yet at this DIM" is distinct from a
 * genuine zero-yield day).
 */
export function alignSeriesByDim(
  current: DailyYieldPoint[],
  previous: DailyYieldPoint[],
): DimAlignedPoint[] {
  const currentByDim = new Map(current.map((p) => [p.dim, p.yieldL]));
  const previousByDim = new Map(previous.map((p) => [p.dim, p.yieldL]));
  const maxDim = Math.max(
    current.length ? current[current.length - 1].dim : -1,
    previous.length ? previous[previous.length - 1].dim : -1,
  );

  const points: DimAlignedPoint[] = [];
  for (let dim = 0; dim <= maxDim; dim += 1) {
    points.push({
      dim,
      currentYieldL: currentByDim.get(dim) ?? null,
      previousYieldL: previousByDim.get(dim) ?? null,
    });
  }
  return points;
}

export type LactationComparisonGroupBy = 'parity' | 'shed' | 'dimRange';

/** DIM-range buckets for `groupBy=dimRange` — mirrors common dairy-management stage bands (early/mid/late lactation, tail). */
export const DIM_RANGE_BUCKETS: {
  key: string;
  label: string;
  min: number;
  max: number | null;
}[] = [
  { key: '0-60', label: '0-60 DIM', min: 0, max: 60 },
  { key: '61-120', label: '61-120 DIM', min: 61, max: 120 },
  { key: '121-200', label: '121-200 DIM', min: 121, max: 200 },
  { key: '201-305', label: '201-305 DIM', min: 201, max: 305 },
  { key: '306+', label: '306+ DIM', min: 306, max: null },
];

/** Bucket key for `groupBy=dimRange` — always resolves (falls through to the open-ended last bucket). */
export function dimRangeBucketKey(dim: number): string {
  const bucket = DIM_RANGE_BUCKETS.find(
    (b) => dim >= b.min && (b.max === null || dim <= b.max),
  );
  return (bucket ?? DIM_RANGE_BUCKETS[DIM_RANGE_BUCKETS.length - 1]).key;
}

export function dimRangeBucketLabel(key: string): string {
  return DIM_RANGE_BUCKETS.find((b) => b.key === key)?.label ?? key;
}

/** Bucket key for `groupBy=parity` — parities 4 and above are pooled ("4+"), same convention many dairy-management reports use since sample size per exact parity thins out fast past 3-4 calvings. */
export function parityBucketKey(lactationNumber: number): string {
  return lactationNumber >= 4 ? '4+' : String(lactationNumber);
}

/** One active lactation's current snapshot, the input unit for `aggregateByBucket`. */
export interface LactationGroupSnapshot {
  cattleId: string;
  lactationId: string;
  bucketKey: string;
  bucketLabel: string;
  dim: number;
  sevenDayAvgYield: number;
  peakMilkYield: number | null;
  persistencyPct: number | null;
}

export interface LactationGroupBucketResult {
  bucketKey: string;
  bucketLabel: string;
  cowCount: number;
  avgDim: number;
  avgSevenDayYield: number;
  /** `null` when no snapshot in this bucket has a recorded peak yet. */
  avgPeakMilkYield: number | null;
  /** `null` when no snapshot in this bucket has a computable persistency yet. */
  avgPersistencyPct: number | null;
}

/**
 * Averages yield/peak/persistency per bucket. Peak/persistency averages skip
 * snapshots where that value is `null` (no recorded peak yet) rather than
 * treating a missing value as zero, which would silently drag the bucket
 * average down for a reason that has nothing to do with actual production.
 */
export function aggregateByBucket(
  snapshots: LactationGroupSnapshot[],
): LactationGroupBucketResult[] {
  const buckets = new Map<
    string,
    { label: string; items: LactationGroupSnapshot[] }
  >();
  for (const snapshot of snapshots) {
    const bucket = buckets.get(snapshot.bucketKey) ?? {
      label: snapshot.bucketLabel,
      items: [],
    };
    bucket.items.push(snapshot);
    buckets.set(snapshot.bucketKey, bucket);
  }

  const results: LactationGroupBucketResult[] = [];
  for (const [bucketKey, { label, items }] of buckets) {
    const peakValues = items
      .map((i) => i.peakMilkYield)
      .filter((v): v is number => v != null);
    const persistencyValues = items
      .map((i) => i.persistencyPct)
      .filter((v): v is number => v != null);

    results.push({
      bucketKey,
      bucketLabel: label,
      cowCount: items.length,
      avgDim: round(average(items.map((i) => i.dim))),
      avgSevenDayYield: round(average(items.map((i) => i.sevenDayAvgYield))),
      avgPeakMilkYield: peakValues.length ? round(average(peakValues)) : null,
      avgPersistencyPct: persistencyValues.length
        ? round(average(persistencyValues))
        : null,
    });
  }

  return results.sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
