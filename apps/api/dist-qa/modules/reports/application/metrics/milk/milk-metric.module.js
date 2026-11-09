"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.milkMetricModule = exports.MILK_REASON = void 0;
exports.buildMilkOutput = buildMilkOutput;
const farm_time_1 = require("../../../../../common/farm-time/farm-time");
const metric_value_1 = require("../../../domain/contracts/metric-value");
const eligibility_1 = require("../../../domain/eligibility");
const period_1 = require("../../../domain/period");
const milk_aggregation_1 = require("./milk-aggregation");
const milk_definitions_1 = require("./milk-definitions");
const milk_fetch_1 = require("./milk-fetch");
exports.MILK_REASON = {
    noRows: 'reports.milk.no_submitted_rows',
    noRecordedCowDays: 'reports.milk.no_recorded_cow_days',
    noRowsForDay: 'reports.milk.no_rows_for_day',
    noRowsForCow: 'reports.milk.no_rows_for_cow',
    noCompleteData: 'reports.milk.no_complete_data_for_drop_check',
    noExpectedDays: 'reports.milk.expected_days_unknown',
};
const NOT_APPLICABLE = { state: 'not_applicable' };
const result = (metricId, value, source = null, comparison = null) => ({
    metricId,
    value,
    source,
    comparison,
    requiresPermission: null,
});
const noRowsForCow = {
    state: 'missing',
    reason: exports.MILK_REASON.noRowsForCow,
};
const row = (key, value) => ({
    key,
    label: null,
    value,
    source: null,
});
const withRows = (metricId, value, rows) => ({ ...result(metricId, value), rows });
function expectedDays(period, timezone, generatedAt) {
    const today = (0, farm_time_1.localDateIso)(timezone, generatedAt);
    return (0, period_1.enumerateDays)(period).filter((d) => d <= today);
}
const totalValue = (a, scopeEmpty) => scopeEmpty
    ? NOT_APPLICABLE
    : a.totalYieldL === null
        ? { state: 'missing', reason: exports.MILK_REASON.noRows }
        : (0, metric_value_1.valueOf)(a.totalYieldL, 'L');
const avgValue = (a, scopeEmpty) => scopeEmpty
    ? NOT_APPLICABLE
    : a.avgDailyYieldPerRecordedCowDayL === null
        ? { state: 'missing', reason: exports.MILK_REASON.noRecordedCowDays }
        : (0, metric_value_1.valueOf)(a.avgDailyYieldPerRecordedCowDayL, 'L');
function buildMilkOutput(args) {
    const { current: cur, previous: prev, ctx } = args;
    const scopeEmpty = ctx.cattleIds.length === 0;
    const metrics = [];
    const curTotal = totalValue(cur, scopeEmpty);
    const curAvg = avgValue(cur, scopeEmpty);
    metrics.push(result('milk.total_yield', curTotal, null, prev ? (0, metric_value_1.compareMetric)(curTotal, totalValue(prev, false)) : null), result('milk.avg_daily_yield', curAvg, null, prev ? (0, metric_value_1.compareMetric)(curAvg, avgValue(prev, false)) : null), result('milk.cows_with_data', scopeEmpty ? NOT_APPLICABLE : (0, metric_value_1.valueOf)(cur.cowsWithData, 'cows')), result('milk.expected_cow_days', scopeEmpty ? NOT_APPLICABLE : (0, metric_value_1.valueOf)(cur.expectedCowDays, 'cow-days')), result('milk.recorded_cow_days', scopeEmpty ? NOT_APPLICABLE : (0, metric_value_1.valueOf)(cur.recordedCowDays, 'cow-days')));
    metrics.push({
        ...result('milk.daily_yield', curTotal),
        series: cur.daily.map((d) => ({
            key: d.date,
            value: scopeEmpty
                ? NOT_APPLICABLE
                : d.yieldL === null
                    ? { state: 'missing', reason: exports.MILK_REASON.noRowsForDay }
                    : (0, metric_value_1.valueOf)(d.yieldL, 'L'),
        })),
    }, withRows('milk.cow_total_yield', curTotal, [
        ...cur.perCow.map((c) => row(c.cattleId, (0, metric_value_1.valueOf)(c.totalYieldL, 'L'))),
        ...cur.cowsWithoutData.map((id) => row(id, noRowsForCow)),
    ]), withRows('milk.cow_avg_daily_yield', curAvg, [
        ...cur.perCow.map((c) => row(c.cattleId, (0, metric_value_1.valueOf)(c.avgPerRecordedDayL, 'L'))),
        ...cur.cowsWithoutData.map((id) => row(id, noRowsForCow)),
    ]), withRows('milk.cow_recorded_days', scopeEmpty ? NOT_APPLICABLE : (0, metric_value_1.valueOf)(cur.recordedCowDays, 'cow-days'), cur.perCow.map((c) => row(c.cattleId, (0, metric_value_1.valueOf)(c.recordedDays, 'days')))), withRows('milk.cow_expected_days', scopeEmpty ? NOT_APPLICABLE : (0, metric_value_1.valueOf)(cur.expectedCowDays, 'cow-days'), ctx.cattleIds.map((id) => {
        const n = cur.expectedDaysByCow[id];
        return row(id, n === undefined
            ? { state: 'missing', reason: exports.MILK_REASON.noExpectedDays }
            : (0, metric_value_1.valueOf)(n, 'days'));
    })));
    const { top, bottom } = (0, milk_aggregation_1.rankCows)(cur.perCow);
    const ranked = (id, list) => withRows(id, scopeEmpty
        ? NOT_APPLICABLE
        : list.length
            ? (0, metric_value_1.valueOf)(list.length, 'cows')
            : { state: 'missing', reason: exports.MILK_REASON.noRows }, list.map((c) => row(c.cattleId, (0, metric_value_1.valueOf)(c.avgPerRecordedDayL, 'L'))));
    metrics.push(ranked('milk.top_cow_avg_yield', top), ranked('milk.bottom_cow_avg_yield', bottom), withRows('milk.disposition_yield', curTotal, Object.keys(cur.dispositionTotalsL)
        .sort()
        .map((k) => row(k, (0, metric_value_1.valueOf)(cur.dispositionTotalsL[k], 'L')))));
    const drops = (0, milk_aggregation_1.evaluateSuddenDrops)({
        rows: args.currentRows,
        cattleIds: ctx.cattleIds,
        evaluatedDate: cur.days.length ? cur.days[cur.days.length - 1] : null,
        expectedSessions: args.expectedSessions,
        dropThresholdPct: ctx.thresholds.suddenDropPct,
    });
    metrics.push(result('milk.sudden_drop_cows', scopeEmpty
        ? NOT_APPLICABLE
        : drops.evaluatedCows === 0
            ? { state: 'not_calculated', reason: exports.MILK_REASON.noCompleteData }
            : (0, metric_value_1.valueOf)(drops.findings.length, 'cows')));
    const exceptions = drops.findings.length
        ? [
            {
                code: 'milk.sudden_drop',
                domain: 'milk',
                messageKey: 'reports.exception.milk.sudden_drop',
                cattleIds: drops.findings.map((f) => f.cattleId),
            },
        ]
        : [];
    return {
        section: {
            id: 'milk',
            domain: 'milk',
            titleKey: 'reports.section.milk',
            metrics,
        },
        exceptions,
        dataQuality: (0, eligibility_1.buildDataQuality)({
            coverage: (0, eligibility_1.buildCoverage)(cur.expectedCowDays, cur.recordedCowDays),
            hasUnsubmittedDrafts: args.draftCount > 0,
            hasEstimatedValues: !scopeEmpty && cur.expectedEstimated,
            scopeEmpty,
        }),
    };
}
exports.milkMetricModule = {
    definitions: milk_definitions_1.MILK_DEFINITIONS,
    async compute(ctx) {
        const days = expectedDays(ctx.period, ctx.timezone, ctx.generatedAt);
        const lastDay = days.length ? days[days.length - 1] : ctx.period.endDate;
        const from = (0, period_1.addDaysYmd)(lastDay, -7) < ctx.period.startDate
            ? (0, period_1.addDaysYmd)(lastDay, -7)
            : ctx.period.startDate;
        const base = { farmId: ctx.farmId, cattleIds: ctx.cattleIds };
        const [rows, draftCount, expectedSessions] = await Promise.all([
            (0, milk_fetch_1.fetchSubmittedMilkRows)(ctx.db, {
                ...base,
                from,
                to: ctx.period.endDate,
            }),
            (0, milk_fetch_1.countUnsubmittedDrafts)(ctx.db, {
                ...base,
                from: ctx.period.startDate,
                to: ctx.period.endDate,
            }),
            (0, milk_fetch_1.fetchExpectedSessions)(ctx.db, ctx.farmId),
        ]);
        const current = (0, milk_aggregation_1.aggregateMilk)({
            rows,
            cattleIds: ctx.cattleIds,
            days,
            presence: ctx.cattlePresence,
        });
        let previous = null;
        if (ctx.previousPeriod) {
            const prevDays = expectedDays(ctx.previousPeriod, ctx.timezone, ctx.generatedAt);
            const prevRows = await (0, milk_fetch_1.fetchSubmittedMilkRows)(ctx.db, {
                farmId: ctx.farmId,
                cattleIds: ctx.previousCattleIds,
                from: ctx.previousPeriod.startDate,
                to: ctx.previousPeriod.endDate,
            });
            previous = (0, milk_aggregation_1.aggregateMilk)({
                rows: prevRows,
                cattleIds: ctx.previousCattleIds,
                days: prevDays,
            });
        }
        return buildMilkOutput({
            current,
            previous,
            currentRows: rows,
            draftCount,
            expectedSessions,
            ctx,
        });
    },
};
//# sourceMappingURL=milk-metric.module.js.map