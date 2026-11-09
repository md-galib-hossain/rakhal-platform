"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeLactationPersistency = computeLactationPersistency;
function computeLactationPersistency(params) {
    const { currentSevenDayAvgYield, peakMilkYield, peakDaysInMilk, currentDaysInMilk, } = params;
    if (peakMilkYield == null || peakDaysInMilk == null || peakMilkYield <= 0) {
        return null;
    }
    const daysSincePeak = Math.max(0, currentDaysInMilk - peakDaysInMilk);
    const persistencyPct = round((currentSevenDayAvgYield / peakMilkYield) * 100);
    return {
        currentSevenDayAvgYield,
        peakMilkYield,
        peakDaysInMilk,
        daysSincePeak,
        persistencyPct,
        declinePct: round(100 - persistencyPct),
    };
}
function round(value) {
    return Math.round(value * 100) / 100;
}
//# sourceMappingURL=lactation-persistency.js.map