"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MILK_DEFINITIONS = void 0;
const ELIGIBLE = 'Submitted milk-log rows (submitted:true) of cows in scope and present in the period; drafts excluded';
const MISSING = 'A cow-day with no submitted row is missing, never 0; a row with yieldL 0 is a real zero';
const def = (id, unit, formula, extra = {}) => ({
    id,
    domain: 'milk',
    unit,
    formula,
    eligibilityRule: extra.eligibilityRule ?? ELIGIBLE,
    missingDataRule: extra.missingDataRule ?? MISSING,
    calcVersion: 1,
});
exports.MILK_DEFINITIONS = [
    def('milk.total_yield', 'L', 'sum(yieldL) over eligible rows (all dispositions)', {
        missingDataRule: 'No eligible row at all: state missing. Empty scope: not_applicable',
    }),
    def('milk.avg_daily_yield', 'L', 'total yield / cow-days that have at least one eligible row (never calendar days)', { missingDataRule: 'No recorded cow-day: state missing' }),
    def('milk.cows_with_data', 'cows', 'count of cows with at least one eligible row'),
    def('milk.expected_cow_days', 'cow-days', 'sum over cows of farm-local days inside the cow presence window and up to generation (cows x days, flagged estimated, when presence is unavailable)'),
    def('milk.recorded_cow_days', 'cow-days', 'count of (cow, day) pairs with at least one eligible row'),
    def('milk.daily_yield', 'L', 'series keyed by YYYY-MM-DD: sum(yieldL) of all in-scope cows per day', {
        missingDataRule: 'A day with no row from any cow is missing, not 0',
    }),
    def('milk.cow_total_yield', 'L', 'rows keyed by cattleId: sum(yieldL) per cow', {
        missingDataRule: 'Cow in scope with no eligible row: missing',
    }),
    def('milk.cow_avg_daily_yield', 'L', 'rows keyed by cattleId: total / recorded days', {
        missingDataRule: 'Cow with no recorded day: missing',
    }),
    def('milk.cow_recorded_days', 'days', 'rows keyed by cattleId: days with at least one eligible row'),
    def('milk.cow_expected_days', 'days', 'rows keyed by cattleId: farm-local days inside the cow presence window and up to generation (cows x days estimate when presence is unavailable)'),
    def('milk.top_cow_avg_yield', 'L', 'rows (ranked, keyed by cattleId): top cows by avg per recorded day (max 5)'),
    def('milk.bottom_cow_avg_yield', 'L', 'rows (ranked, keyed by cattleId): lowest cows by avg per recorded day (max 5, never overlaps top)'),
    def('milk.disposition_yield', 'L', 'sum(yieldL) per disposition (informational), rows keyed by disposition', {
        missingDataRule: 'Dispositions with no rows are omitted',
    }),
    def('milk.sudden_drop_cows', 'cows', 'cows whose last period day is >= suddenDropPct below the mean of the 7 days before it (detectSuddenDrop)', {
        eligibilityRule: 'Only cows whose last period day and the 7 days before it are ALL complete (every configured session recorded)',
        missingDataRule: 'No cow had complete data for the 8 days: not_calculated (no exception is raised)',
    }),
];
//# sourceMappingURL=milk-definitions.js.map