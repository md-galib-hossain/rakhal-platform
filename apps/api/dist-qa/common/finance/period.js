"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivePreviousPeriod = derivePreviousPeriod;
exports.changePct = changePct;
function derivePreviousPeriod(period) {
    const durationMs = period.to.getTime() - period.from.getTime();
    return {
        from: new Date(period.from.getTime() - durationMs),
        to: new Date(period.from.getTime() - 1),
    };
}
function changePct(current, previous) {
    if (!previous)
        return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}
//# sourceMappingURL=period.js.map