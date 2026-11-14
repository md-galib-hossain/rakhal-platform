import {
  aggregateByBucket,
  alignSeriesByDim,
  dimRangeBucketKey,
  dimRangeBucketLabel,
  LactationGroupSnapshot,
  parityBucketKey,
} from './lactation-comparison';
import { DailyYieldPoint } from './lactation-curve';

/** Minimal `DailyYieldPoint` fixture — only `dim`/`yieldL` matter for these tests. */
function point(dim: number, yieldL: number): DailyYieldPoint {
  return {
    dim,
    date: `2026-01-${String(dim + 1).padStart(2, '0')}`,
    yieldL,
    sessionsRecorded: 2,
    sessionsExpected: 2,
    dataQuality: 'complete',
  };
}

describe('alignSeriesByDim (RAKHAL-287)', () => {
  it('pairs two series by dim, not by calendar date — day 1 lines up with day 1 even when the underlying dates differ', () => {
    // "Current" lactation started 2026-07-01 (dim 0 = 2026-07-01).
    const current = [point(0, 10), point(1, 12), point(2, 14)];
    // "Previous" lactation started a full year earlier — completely
    // different calendar dates, but the same dim indices.
    const previous = [point(0, 9), point(1, 11), point(2, 13)];

    const aligned = alignSeriesByDim(current, previous);

    expect(aligned).toEqual([
      { dim: 0, currentYieldL: 10, previousYieldL: 9 },
      { dim: 1, currentYieldL: 12, previousYieldL: 11 },
      { dim: 2, currentYieldL: 14, previousYieldL: 13 },
    ]);
  });

  it('fills null (not zero) past the shorter series length', () => {
    const current = [point(0, 10), point(1, 12), point(2, 14), point(3, 16)];
    const previous = [point(0, 9), point(1, 11)];

    const aligned = alignSeriesByDim(current, previous);

    expect(aligned).toHaveLength(4);
    expect(aligned[2]).toEqual({
      dim: 2,
      currentYieldL: 14,
      previousYieldL: null,
    });
    expect(aligned[3]).toEqual({
      dim: 3,
      currentYieldL: 16,
      previousYieldL: null,
    });
  });

  it('returns an empty array when both series are empty', () => {
    expect(alignSeriesByDim([], [])).toEqual([]);
  });

  it('handles an empty previous series (no comparison lactation) — current-only, all previous null', () => {
    const current = [point(0, 10), point(1, 12)];

    const aligned = alignSeriesByDim(current, []);

    expect(aligned).toEqual([
      { dim: 0, currentYieldL: 10, previousYieldL: null },
      { dim: 1, currentYieldL: 12, previousYieldL: null },
    ]);
  });
});

describe('parityBucketKey (RAKHAL-287)', () => {
  it.each([
    [1, '1'],
    [2, '2'],
    [3, '3'],
    [4, '4+'],
    [7, '4+'],
  ])('lactationNumber %i -> bucket %s', (lactationNumber, expected) => {
    expect(parityBucketKey(lactationNumber)).toBe(expected);
  });
});

describe('dimRangeBucketKey / dimRangeBucketLabel (RAKHAL-287)', () => {
  it.each([
    [0, '0-60'],
    [60, '0-60'],
    [61, '61-120'],
    [120, '61-120'],
    [201, '201-305'],
    [305, '201-305'],
    [306, '306+'],
    [500, '306+'],
  ])('dim %i -> bucket %s', (dim, expected) => {
    expect(dimRangeBucketKey(dim)).toBe(expected);
  });

  it('resolves a human-readable label for a known bucket key', () => {
    expect(dimRangeBucketLabel('61-120')).toBe('61-120 DIM');
  });

  it('falls back to the raw key for an unknown bucket key', () => {
    expect(dimRangeBucketLabel('bogus')).toBe('bogus');
  });
});

describe('aggregateByBucket (RAKHAL-287)', () => {
  function snapshot(
    overrides: Partial<LactationGroupSnapshot>,
  ): LactationGroupSnapshot {
    return {
      cattleId: 'cattle-1',
      lactationId: 'lact-1',
      bucketKey: '1',
      bucketLabel: 'Parity 1',
      dim: 50,
      sevenDayAvgYield: 10,
      peakMilkYield: 15,
      persistencyPct: 66.67,
      ...overrides,
    };
  }

  it('averages yield/dim per bucket and counts cows', () => {
    const buckets = aggregateByBucket([
      snapshot({
        cattleId: 'c1',
        bucketKey: '1',
        sevenDayAvgYield: 10,
        dim: 40,
      }),
      snapshot({
        cattleId: 'c2',
        bucketKey: '1',
        sevenDayAvgYield: 20,
        dim: 60,
      }),
      snapshot({
        cattleId: 'c3',
        bucketKey: '2',
        sevenDayAvgYield: 5,
        dim: 100,
      }),
    ]);

    expect(buckets).toHaveLength(2);
    const bucket1 = buckets.find((b) => b.bucketKey === '1');
    expect(bucket1).toMatchObject({
      cowCount: 2,
      avgSevenDayYield: 15,
      avgDim: 50,
    });
    const bucket2 = buckets.find((b) => b.bucketKey === '2');
    expect(bucket2).toMatchObject({ cowCount: 1, avgSevenDayYield: 5 });
  });

  it('excludes null peak/persistency from their own averages rather than treating them as zero', () => {
    const buckets = aggregateByBucket([
      snapshot({ cattleId: 'c1', peakMilkYield: 20, persistencyPct: 80 }),
      snapshot({ cattleId: 'c2', peakMilkYield: null, persistencyPct: null }),
    ]);

    expect(buckets[0].cowCount).toBe(2);
    // Average of [20] (the null is excluded), not [20, 0]/2 = 10.
    expect(buckets[0].avgPeakMilkYield).toBe(20);
    expect(buckets[0].avgPersistencyPct).toBe(80);
  });

  it('returns null averages for a bucket where every snapshot has no recorded peak yet', () => {
    const buckets = aggregateByBucket([
      snapshot({ cattleId: 'c1', peakMilkYield: null, persistencyPct: null }),
    ]);

    expect(buckets[0].avgPeakMilkYield).toBeNull();
    expect(buckets[0].avgPersistencyPct).toBeNull();
  });

  it('returns an empty array for no snapshots', () => {
    expect(aggregateByBucket([])).toEqual([]);
  });

  it('sorts buckets by bucketKey', () => {
    const buckets = aggregateByBucket([
      snapshot({ cattleId: 'c1', bucketKey: '4+' }),
      snapshot({ cattleId: 'c2', bucketKey: '1' }),
      snapshot({ cattleId: 'c3', bucketKey: '2' }),
    ]);

    expect(buckets.map((b) => b.bucketKey)).toEqual(['1', '2', '4+']);
  });
});
