"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.daysBetween = daysBetween;
exports.buildLactationCurve = buildLactationCurve;
exports.trendPct = trendPct;
const DAY_MS = 1000 * 60 * 60 * 24;
const round = (value) => Math.round(value * 100) / 100;
function daysBetween(start, end) {
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
}
function buildLactationCurve(lactationStart, dailyYields) {
    return dailyYields
        .filter((d) => d.date.getTime() >= lactationStart.getTime())
        .map((d) => ({
        dim: daysBetween(lactationStart, d.date),
        yield_l: round(d.totalL),
    }))
        .sort((a, b) => a.dim - b.dim);
}
function trendPct(current, previous) {
    if (!previous) {
        return current ? 100 : null;
    }
    return round(((current - previous) / previous) * 100);
}
//# sourceMappingURL=lactation-curve.js.map