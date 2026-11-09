"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDryOffProjection = computeDryOffProjection;
exports.computeStandardized305DayYield = computeStandardized305DayYield;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FALLBACK_RANGE_DAYS = [270, 330];
const SINGLE_VALUE_PAD_DAYS = 15;
function computeDryOffProjection(input) {
    if (input.isPregnant) {
        const recommendedDryOffAt = new Date(input.expectedCalvingDate.getTime() - input.dryPeriodDays * DAY_MS);
        return {
            recommendedDryOffAt,
            managementEstimateDimRange: null,
            confidence: null,
            reason: null,
        };
    }
    const { previousLactationLengthsDays } = input;
    const [fallbackMin, fallbackMax] = input.fallbackRangeDays ?? DEFAULT_FALLBACK_RANGE_DAYS;
    if (previousLactationLengthsDays.length === 0) {
        return {
            recommendedDryOffAt: null,
            managementEstimateDimRange: [fallbackMin, fallbackMax],
            confidence: 'LOW',
            reason: 'Not pregnant, so no confirmed expected-calving date exists yet, and this cow has no completed prior lactation on record — using a standard dairy lactation-length fallback range.',
        };
    }
    const min = Math.min(...previousLactationLengthsDays);
    const max = Math.max(...previousLactationLengthsDays);
    const range = min === max
        ? [
            Math.max(0, Math.round(min - SINGLE_VALUE_PAD_DAYS)),
            Math.round(max + SINGLE_VALUE_PAD_DAYS),
        ]
        : [Math.round(min), Math.round(max)];
    return {
        recommendedDryOffAt: null,
        managementEstimateDimRange: range,
        confidence: 'LOW',
        reason: `Not pregnant, so no confirmed expected-calving date exists yet — estimated from this cow's ${previousLactationLengthsDays.length} prior lactation(s) on record.`,
    };
}
function computeStandardized305DayYield(params) {
    const { producedToDateL, daysInMilk, minDimThreshold } = params;
    if (daysInMilk < minDimThreshold || daysInMilk <= 0) {
        return null;
    }
    const projected = (producedToDateL / daysInMilk) * 305;
    return Math.round(projected * 100) / 100;
}
//# sourceMappingURL=lactation-dry-off-projection.js.map