"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reproMetricModule = exports.REPRO_DEFINITIONS = void 0;
const money_1 = require("src/common/money");
const metric_value_1 = require("../../../domain/contracts/metric-value");
const eligibility_1 = require("../../../domain/eligibility");
const repro_aggregation_1 = require("./repro-aggregation");
const repro_fetch_1 = require("./repro-fetch");
const DAY_MS = 86_400_000;
const CALVING_HORIZON_DAYS = 30;
const COHORT = 'Services (non-voided breeding events) whose breedingDate is in the period, for cows in scope.';
const COHORT_OUTCOME = `${COHORT} Grouped by breeding date, not outcome date.`;
const ZERO_OK = 'Counts are 0 when nothing was recorded (a genuine zero).';
const def = (name, unit, formula, eligibilityRule, missingDataRule, extra = {}) => ({
    id: `reproduction.${name}`,
    domain: 'reproduction',
    unit,
    formula,
    eligibilityRule,
    missingDataRule,
    calcVersion: 1,
    ...extra,
});
exports.REPRO_DEFINITIONS = [
    def('services_total', 'count', 'count(services)', COHORT, ZERO_OK),
    def('services_ai', 'count', 'count(services where method=AI)', COHORT, ZERO_OK),
    def('services_natural', 'count', 'count(services where method=NATURAL)', COHORT, ZERO_OK),
    def('services_embryo_transfer', 'count', 'count(services where method=EMBRYO_TRANSFER)', COHORT, ZERO_OK),
    def('services_unique_cows', 'cows', 'count(distinct cow over services)', COHORT, ZERO_OK),
    def('outcomes_confirmed', 'count', 'services with status PREGNANT or CALVED', COHORT_OUTCOME, ZERO_OK),
    def('outcomes_pending', 'count', 'services with status PENDING_CHECK (unknown, never a failure)', COHORT_OUTCOME, ZERO_OK),
    def('outcomes_failed', 'count', 'services with status FAILED', COHORT_OUTCOME, ZERO_OK),
    def('outcomes_other', 'count', 'services with status RETURNED_TO_HEAT or ABORTED', COHORT_OUTCOME, ZERO_OK),
    def('services_decided', 'count', 'confirmed + failed', COHORT_OUTCOME, ZERO_OK),
    def('conception_rate', '%', `confirmed / (confirmed + failed) x 100. Pending and other outcomes are never in the denominator. Minimum decided services: ${repro_aggregation_1.MIN_DECIDED_FOR_CONCEPTION_RATE}.`, `${COHORT_OUTCOME} Decided services only.`, `not_calculated when decided = 0 or below ${repro_aggregation_1.MIN_DECIDED_FOR_CONCEPTION_RATE} (small/undecided cohort).`),
    def('pregnancy_checks_overdue', 'count', 'count(PENDING_CHECK where expectedPregnancyCheckDate < report generation time)', 'All unresolved services of cows in scope, any breeding date; current state at generation, not period-able.', 'Services without an expected check date are not counted as overdue.'),
    def('calvings', 'count', 'count(CalvingEvent in period)', 'calvingDate in period, cows in scope.', ZERO_OK),
    def('calves_born', 'count', 'sum(CalvingEvent.calfCount in period)', 'calvingDate in period, cows in scope.', ZERO_OK),
    def('abortions', 'count', 'count(AbortionEvent in period)', 'abortionDate in period, cows in scope.', ZERO_OK),
    def('expected_calvings_30d', 'count', `count(ACTIVE pregnancies with expectedCalvingDate in [generatedAt, generatedAt + ${CALVING_HORIZON_DAYS} days))`, 'Active pregnancies of cows in scope; current state at generation, not period-able.', ZERO_OK),
    def('ai_cost_total', 'BDT', 'sum(Expense.amount) for cohort services via financeTransactionId, voided expenses excluded', `${COHORT} Reads the linked Expense; cost resolution is not replicated.`, 'missing when services exist but none carries a cost link.', { requiresPermission: 'finance.read' }),
];
function result(name, value, previous, requiresPermission = null) {
    return {
        metricId: `reproduction.${name}`,
        value,
        source: null,
        comparison: previous ? (0, metric_value_1.compareMetric)(value, previous) : null,
        requiresPermission,
    };
}
const count = (n, unit = 'count') => (0, metric_value_1.valueOf)(n, unit);
exports.reproMetricModule = {
    definitions: exports.REPRO_DEFINITIONS,
    async compute(ctx) {
        const { db, period, generatedAt } = ctx;
        const notHistorical = await (0, repro_fetch_1.notHistoricalClause)(db, ctx.farmId);
        const cohortRows = await (0, repro_fetch_1.fetchCohortServices)(db, ctx.farmId, ctx.cattleIds, period, notHistorical);
        const cur = (0, repro_aggregation_1.aggregateServices)(cohortRows, generatedAt);
        let prev = null;
        let prevCalv = null;
        let prevAbort = null;
        if (ctx.previousPeriod) {
            prev = (0, repro_aggregation_1.aggregateServices)(await (0, repro_fetch_1.fetchCohortServices)(db, ctx.farmId, ctx.previousCattleIds, ctx.previousPeriod, notHistorical), generatedAt);
            prevCalv = await (0, repro_fetch_1.fetchCalvings)(db, ctx.farmId, ctx.previousCattleIds, ctx.previousPeriod, notHistorical);
            prevAbort = await (0, repro_fetch_1.fetchAbortions)(db, ctx.farmId, ctx.previousCattleIds, ctx.previousPeriod, notHistorical);
        }
        const calv = await (0, repro_fetch_1.fetchCalvings)(db, ctx.farmId, ctx.cattleIds, period, notHistorical);
        const aborts = await (0, repro_fetch_1.fetchAbortions)(db, ctx.farmId, ctx.cattleIds, period, notHistorical);
        const pending = (0, repro_aggregation_1.aggregateServices)(await (0, repro_fetch_1.fetchPendingServices)(db, ctx.farmId, ctx.cattleIds, notHistorical), generatedAt);
        const expectedCalvings = await (0, repro_fetch_1.fetchExpectedCalvings)(db, ctx.farmId, ctx.cattleIds, generatedAt, new Date(generatedAt.getTime() + CALVING_HORIZON_DAYS * DAY_MS));
        const pv = (f, unit = 'count') => prev ? count(f(prev), unit) : null;
        const pn = (n) => n === null ? null : count(n);
        const metrics = [
            result('services_total', count(cur.total), pv((a) => a.total)),
            result('services_ai', count(cur.byMethod.AI.events), pv((a) => a.byMethod.AI.events)),
            result('services_natural', count(cur.byMethod.NATURAL.events), pv((a) => a.byMethod.NATURAL.events)),
            result('services_embryo_transfer', count(cur.byMethod.EMBRYO_TRANSFER.events), pv((a) => a.byMethod.EMBRYO_TRANSFER.events)),
            result('services_unique_cows', count(cur.uniqueCows, 'cows'), pv((a) => a.uniqueCows, 'cows')),
            result('outcomes_confirmed', count(cur.confirmed), pv((a) => a.confirmed)),
            result('outcomes_pending', count(cur.pending), pv((a) => a.pending)),
            result('outcomes_failed', count(cur.failed), pv((a) => a.failed)),
            result('outcomes_other', count(cur.other), pv((a) => a.other)),
            result('services_decided', count(cur.decided), pv((a) => a.decided)),
            result('conception_rate', (0, repro_aggregation_1.conceptionRate)(cur.confirmed, cur.failed), prev ? (0, repro_aggregation_1.conceptionRate)(prev.confirmed, prev.failed) : null),
            result('pregnancy_checks_overdue', count(pending.overdueChecks), null),
            result('calvings', count(calv.calvings), pn(prevCalv?.calvings ?? null)),
            result('calves_born', count(calv.calves), pn(prevCalv?.calves ?? null)),
            result('abortions', count(aborts), pn(prevAbort)),
            result('expected_calvings_30d', count(expectedCalvings), null),
        ];
        let anyCostLinked = false;
        if (ctx.includeFinance) {
            const ids = cohortRows
                .filter((r) => r.financeTransactionId)
                .map((r) => r.financeTransactionId);
            anyCostLinked = ids.length > 0;
            const expenses = await (0, repro_fetch_1.fetchLinkedExpenses)(db, ctx.farmId, ids);
            const value = cur.total > 0 && ids.length === 0
                ? { state: 'missing', reason: 'no service carries a cost link' }
                : count((0, money_1.round2)((0, repro_aggregation_1.sumLinkedCost)(expenses)).toNumber(), 'BDT');
            metrics.push(result('ai_cost_total', value, null, 'finance.read'));
        }
        const exceptions = [];
        if (pending.overdueChecks > 0)
            exceptions.push({
                code: 'reproduction.pregnancy_check_overdue',
                domain: 'reproduction',
                messageKey: 'reports.exception.reproduction.pregnancy_check_overdue',
            });
        if (cur.cowsWithRepeatedFailures.length > 0)
            exceptions.push({
                code: 'reproduction.repeated_failed_services',
                domain: 'reproduction',
                messageKey: 'reports.exception.reproduction.repeated_failed_services',
                cattleIds: cur.cowsWithRepeatedFailures,
            });
        const dataQuality = (0, eligibility_1.buildDataQuality)({
            coverage: (0, eligibility_1.buildCoverage)(cur.dueForCheck, cur.confirmed + cur.failed + cur.other),
            hasUnknownCosts: ctx.includeFinance && cur.aiWithoutCostLink > 0,
            scopeEmpty: ctx.cattleIds.length === 0,
        });
        if (ctx.includeFinance && cur.aiWithoutCostLink > 0 && anyCostLinked)
            dataQuality.notes.push('reports.dq.partial_costs');
        return {
            section: {
                id: 'reproduction.overview',
                domain: 'reproduction',
                titleKey: 'reports.section.reproduction',
                metrics,
            },
            exceptions,
            dataQuality,
        };
    },
};
//# sourceMappingURL=repro-metrics.js.map