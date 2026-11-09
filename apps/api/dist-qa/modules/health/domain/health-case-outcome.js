"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECURRENCE_WINDOW_DAYS = void 0;
exports.elapsedDays = elapsedDays;
exports.dayOfIllness = dayOfIllness;
exports.findPreviousSameCondition = findPreviousSameCondition;
exports.aggregateOutcomes = aggregateOutcomes;
const DAY_MS = 24 * 60 * 60 * 1000;
exports.RECURRENCE_WINDOW_DAYS = 60;
function elapsedDays(from, to) {
    return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}
function dayOfIllness(start, now) {
    return Math.max(1, Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1);
}
function findPreviousSameCondition(current, others, windowDays = exports.RECURRENCE_WINDOW_DAYS) {
    if (!current.condition)
        return null;
    const earliest = current.startDate.getTime() - windowDays * DAY_MS;
    let best = null;
    for (const other of others) {
        if (other.id === current.id)
            continue;
        if (other.cattleId !== current.cattleId)
            continue;
        if (other.condition !== current.condition)
            continue;
        if (!other.closedDate)
            continue;
        const closed = other.closedDate.getTime();
        if (closed > current.startDate.getTime() || closed < earliest)
            continue;
        if (!best || closed > best.closedDate.getTime())
            best = other;
    }
    return best;
}
const round = (n, places) => {
    const f = 10 ** places;
    return Math.round(n * f) / f;
};
const mean = (values, places) => values.length
    ? round(values.reduce((a, b) => a + b, 0) / values.length, places)
    : null;
function breakdown(cases) {
    const recoveredCases = cases.filter((c) => c.status === 'RECOVERED');
    const mortality = cases.filter((c) => c.status === 'MORTALITY').length;
    const decided = recoveredCases.length + mortality;
    return {
        cases: cases.length,
        recovered: recoveredCases.length,
        mortality,
        recoveryRate: decided
            ? round((recoveredCases.length / decided) * 100, 1)
            : null,
        avgDaysToRecover: mean(recoveredCases
            .filter((c) => c.closedDate)
            .map((c) => elapsedDays(c.startDate, c.closedDate)), 1),
        avgCost: mean(cases.map((c) => c.cost), 2),
    };
}
function aggregateOutcomes(cases) {
    const closedStatuses = new Set(['RECOVERED', 'MORTALITY', 'CLOSED']);
    const open = cases.filter((c) => !closedStatuses.has(c.status));
    const base = breakdown(cases);
    const byKey = new Map();
    for (const c of cases) {
        const list = byKey.get(c.condition);
        if (list)
            list.push(c);
        else
            byKey.set(c.condition, [c]);
    }
    const byCondition = [...byKey.entries()]
        .map(([condition, list]) => ({ condition, ...breakdown(list) }))
        .sort((a, b) => b.cases - a.cases ||
        Number(a.condition === null) - Number(b.condition === null) ||
        String(a.condition).localeCompare(String(b.condition)));
    return {
        ...base,
        openCases: open.length,
        otherClosed: cases.filter((c) => c.status === 'CLOSED').length,
        totalCost: round(cases.reduce((sum, c) => sum + c.cost, 0), 2),
        recurrenceRate: cases.length
            ? round((cases.filter((c) => c.isRecurrence).length / cases.length) * 100, 1)
            : null,
        byCondition,
    };
}
//# sourceMappingURL=health-case-outcome.js.map