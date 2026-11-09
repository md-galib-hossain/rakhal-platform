"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streakDates = streakDates;
exports.offTargetCows = offTargetCows;
function streakDates(endYmd, days) {
    const end = new Date(`${endYmd}T00:00:00.000Z`).getTime();
    return Array.from({ length: days }, (_, i) => new Date(end - i * 86_400_000).toISOString().slice(0, 10));
}
function offTargetCows(rows, dates) {
    const badDays = new Map();
    for (const r of rows) {
        if (r.estimated || r.severity === 'OK')
            continue;
        if (!dates.includes(r.date))
            continue;
        const set = badDays.get(r.cattleId) ?? new Set();
        set.add(r.date);
        badDays.set(r.cattleId, set);
    }
    return [...badDays.entries()]
        .filter(([, days]) => days.size === dates.length)
        .map(([cattleId]) => cattleId)
        .sort();
}
//# sourceMappingURL=fit-streak.js.map