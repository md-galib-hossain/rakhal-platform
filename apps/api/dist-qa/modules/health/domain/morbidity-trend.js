"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickBucket = pickBucket;
exports.buildTrend = buildTrend;
const DAY_MS = 24 * 60 * 60 * 1000;
function pickBucket(spanDays) {
    if (spanDays <= 60)
        return 'day';
    if (spanDays <= 200)
        return 'week';
    return 'month';
}
function bucketKey(date, bucket) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    if (bucket === 'week') {
        const sinceMonday = (d.getUTCDay() + 6) % 7;
        d.setTime(d.getTime() - sinceMonday * DAY_MS);
    }
    else if (bucket === 'month') {
        d.setUTCDate(1);
    }
    return d.toISOString().slice(0, 10);
}
function buildTrend(dates, from, to) {
    const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
    const bucket = pickBucket(spanDays);
    const counts = new Map();
    for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
        counts.set(bucketKey(new Date(t), bucket), 0);
    }
    const lastKey = bucketKey(to, bucket);
    if (!counts.has(lastKey))
        counts.set(lastKey, 0);
    for (const date of dates) {
        const key = bucketKey(date, bucket);
        if (counts.has(key))
            counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return {
        bucket,
        points: [...counts.entries()].map(([date, count]) => ({ date, count })),
    };
}
//# sourceMappingURL=morbidity-trend.js.map