"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WINBACK_CADENCE = exports.PRE_EXPIRY_CADENCE = void 0;
exports.calendarDaysBetween = calendarDaysBetween;
exports.preExpiryStageFor = preExpiryStageFor;
exports.winbackStageFor = winbackStageFor;
exports.PRE_EXPIRY_CADENCE = [
    { stage: 'T_MINUS_7', daysUntil: 7 },
    { stage: 'T_MINUS_3', daysUntil: 3 },
    { stage: 'T_MINUS_1', daysUntil: 1 },
    { stage: 'EXPIRY_DAY', daysUntil: 0 },
];
exports.WINBACK_CADENCE = [
    { stage: 'WINBACK_3', daysSince: 3 },
    { stage: 'WINBACK_7', daysSince: 7 },
    { stage: 'WINBACK_30', daysSince: 30 },
];
function calendarDaysBetween(from, to) {
    const DAY = 24 * 60 * 60 * 1000;
    const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.round((b - a) / DAY);
}
function preExpiryStageFor(daysUntil) {
    return (exports.PRE_EXPIRY_CADENCE.find((s) => s.daysUntil === daysUntil)?.stage ?? null);
}
function winbackStageFor(daysSince) {
    return exports.WINBACK_CADENCE.find((s) => s.daysSince === daysSince)?.stage ?? null;
}
//# sourceMappingURL=renewal-cadence.js.map