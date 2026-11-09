"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDailyYieldSeries = buildDailyYieldSeries;
const DAY_MS = 24 * 60 * 60 * 1000;
function startOfUtcDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function isoDate(date) {
    return startOfUtcDay(date).toISOString().slice(0, 10);
}
function round(value) {
    return Math.round(value * 100) / 100;
}
function buildDailyYieldSeries(params) {
    const { startDate, endDate, entries, expectedSessions } = params;
    const start = startOfUtcDay(startDate);
    const end = startOfUtcDay(endDate);
    const expectedCount = Math.max(1, expectedSessions.length);
    const byDay = new Map();
    for (const e of entries) {
        const dayKey = startOfUtcDay(e.logDate).getTime();
        const bucket = byDay.get(dayKey) ?? {
            yieldL: 0,
            sessions: new Set(),
        };
        bucket.yieldL += e.yieldL;
        bucket.sessions.add(e.session);
        byDay.set(dayKey, bucket);
    }
    const series = [];
    for (let cursor = start.getTime(), dim = 0; cursor <= end.getTime(); cursor += DAY_MS, dim += 1) {
        const day = new Date(cursor);
        const bucket = byDay.get(cursor);
        const sessionsRecorded = bucket?.sessions.size ?? 0;
        let dataQuality;
        if (sessionsRecorded === 0) {
            dataQuality = 'missing';
        }
        else if (sessionsRecorded < expectedCount) {
            dataQuality = 'incomplete';
        }
        else {
            dataQuality = 'complete';
        }
        series.push({
            dim,
            date: isoDate(day),
            yieldL: round(bucket?.yieldL ?? 0),
            sessionsRecorded,
            sessionsExpected: expectedCount,
            dataQuality,
        });
    }
    return series;
}
//# sourceMappingURL=lactation-curve.js.map