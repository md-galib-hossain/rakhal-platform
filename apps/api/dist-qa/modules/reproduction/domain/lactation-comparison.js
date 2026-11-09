"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIM_RANGE_BUCKETS = void 0;
exports.alignSeriesByDim = alignSeriesByDim;
exports.dimRangeBucketKey = dimRangeBucketKey;
exports.dimRangeBucketLabel = dimRangeBucketLabel;
exports.parityBucketKey = parityBucketKey;
exports.aggregateByBucket = aggregateByBucket;
function alignSeriesByDim(current, previous) {
    const currentByDim = new Map(current.map((p) => [p.dim, p.yieldL]));
    const previousByDim = new Map(previous.map((p) => [p.dim, p.yieldL]));
    const maxDim = Math.max(current.length ? current[current.length - 1].dim : -1, previous.length ? previous[previous.length - 1].dim : -1);
    const points = [];
    for (let dim = 0; dim <= maxDim; dim += 1) {
        points.push({
            dim,
            currentYieldL: currentByDim.get(dim) ?? null,
            previousYieldL: previousByDim.get(dim) ?? null,
        });
    }
    return points;
}
exports.DIM_RANGE_BUCKETS = [
    { key: '0-60', label: '0-60 DIM', min: 0, max: 60 },
    { key: '61-120', label: '61-120 DIM', min: 61, max: 120 },
    { key: '121-200', label: '121-200 DIM', min: 121, max: 200 },
    { key: '201-305', label: '201-305 DIM', min: 201, max: 305 },
    { key: '306+', label: '306+ DIM', min: 306, max: null },
];
function dimRangeBucketKey(dim) {
    const bucket = exports.DIM_RANGE_BUCKETS.find((b) => dim >= b.min && (b.max === null || dim <= b.max));
    return (bucket ?? exports.DIM_RANGE_BUCKETS[exports.DIM_RANGE_BUCKETS.length - 1]).key;
}
function dimRangeBucketLabel(key) {
    return exports.DIM_RANGE_BUCKETS.find((b) => b.key === key)?.label ?? key;
}
function parityBucketKey(lactationNumber) {
    return lactationNumber >= 4 ? '4+' : String(lactationNumber);
}
function aggregateByBucket(snapshots) {
    const buckets = new Map();
    for (const snapshot of snapshots) {
        const bucket = buckets.get(snapshot.bucketKey) ?? {
            label: snapshot.bucketLabel,
            items: [],
        };
        bucket.items.push(snapshot);
        buckets.set(snapshot.bucketKey, bucket);
    }
    const results = [];
    for (const [bucketKey, { label, items }] of buckets) {
        const peakValues = items
            .map((i) => i.peakMilkYield)
            .filter((v) => v != null);
        const persistencyValues = items
            .map((i) => i.persistencyPct)
            .filter((v) => v != null);
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
function average(values) {
    return values.length
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : 0;
}
function round(value) {
    return Math.round(value * 100) / 100;
}
//# sourceMappingURL=lactation-comparison.js.map