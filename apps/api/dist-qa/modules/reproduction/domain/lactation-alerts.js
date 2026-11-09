"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS = exports.DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L = exports.DEFAULT_DRY_OFF_APPROACHING_LEAD_DAYS = exports.DEFAULT_LOW_PEAK_MIN_YIELD_L = exports.DEFAULT_LOW_PEAK_BY_DIM_DAYS = void 0;
exports.detectMissingSession = detectMissingSession;
exports.detectSuddenDrop = detectSuddenDrop;
exports.detectLowPeakByDim = detectLowPeakByDim;
exports.detectLongLactationNotPregnant = detectLongLactationNotPregnant;
exports.detectDryOffApproaching = detectDryOffApproaching;
exports.detectPlannedDryOffDue = detectPlannedDryOffDue;
exports.detectDryOffOverdue = detectDryOffOverdue;
exports.detectLowProductionDryOffReview = detectLowProductionDryOffReview;
exports.DEFAULT_LOW_PEAK_BY_DIM_DAYS = 60;
exports.DEFAULT_LOW_PEAK_MIN_YIELD_L = 8;
exports.DEFAULT_DRY_OFF_APPROACHING_LEAD_DAYS = 14;
exports.DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L = 5;
exports.DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS = 3;
function detectMissingSession(input) {
    return input.dataQuality === 'missing';
}
function detectSuddenDrop(input) {
    const allComplete = input.evaluatedDayDataQuality === 'complete' &&
        input.baselineDaysDataQuality.every((q) => q === 'complete');
    if (!allComplete || input.baselineAvgYieldL <= 0) {
        return { fired: false, dropPct: null };
    }
    const dropPct = Math.max(0, Math.round((1 - input.evaluatedDayYieldL / input.baselineAvgYieldL) * 100));
    return { fired: dropPct >= input.dropThresholdPct, dropPct };
}
function detectLowPeakByDim(input) {
    if (input.currentDim < input.lowPeakByDimDays)
        return false;
    if (input.peakMilkYield == null)
        return true;
    return input.peakMilkYield < input.minExpectedPeakYieldL;
}
function detectLongLactationNotPregnant(input) {
    return (input.currentDim >= input.longLactationDimThresholdDays &&
        !input.hasActivePregnancy);
}
function detectDryOffApproaching(input) {
    if (!input.recommendedDryOffAt)
        return false;
    const daysUntil = daysBetweenUtc(input.now, input.recommendedDryOffAt);
    return daysUntil >= 0 && daysUntil <= input.leadDays;
}
function detectPlannedDryOffDue(input) {
    if (!input.plannedDryOffAt)
        return false;
    return daysBetweenUtc(input.plannedDryOffAt, input.now) === 0;
}
function detectDryOffOverdue(input) {
    if (!input.recommendedDryOffAt)
        return false;
    return daysBetweenUtc(input.recommendedDryOffAt, input.now) > 0;
}
function detectLowProductionDryOffReview(input) {
    if (input.recentDailyYieldsL.length < input.consecutiveDaysRequired) {
        return false;
    }
    const lastN = input.recentDailyYieldsL.slice(-input.consecutiveDaysRequired);
    return lastN.every((y) => y <= input.thresholdL);
}
function startOfUtcDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function daysBetweenUtc(start, end) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    return Math.round((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / DAY_MS);
}
//# sourceMappingURL=lactation-alerts.js.map