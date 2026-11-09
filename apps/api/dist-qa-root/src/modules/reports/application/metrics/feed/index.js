"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedMetricModule = void 0;
const metric_value_1 = require("../../../domain/contracts/metric-value");
const eligibility_1 = require("../../../domain/eligibility");
const feed_aggregation_1 = require("./feed-aggregation");
const feed_definitions_1 = require("./feed-definitions");
const feed_fetch_1 = require("./feed-fetch");
const defById = new Map(feed_definitions_1.FEED_DEFINITIONS.map((d) => [d.id, d]));
function metric(id, value, source, previous, rows) {
    return {
        metricId: id,
        value,
        source,
        comparison: previous ? (0, metric_value_1.compareMetric)(value, previous) : null,
        ...(rows ? { rows } : {}),
        requiresPermission: defById.get(id)?.requiresPermission ?? null,
    };
}
function kgRows(rows, source) {
    return rows.map((r) => ({
        key: r.key,
        label: r.label,
        value: (0, metric_value_1.valueOf)(r.kg, 'kg'),
        source,
    }));
}
function periodDays(startDate, endDate) {
    return (Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1);
}
function lowStockRows(items) {
    return items.map((i) => ({
        key: i.id,
        label: i.name,
        value: (0, metric_value_1.valueOf)(i.stock, i.unit),
        source: feed_definitions_1.SOURCE.asOfGeneration,
    }));
}
const NOT_APPLICABLE = { state: 'not_applicable' };
async function compute(ctx) {
    const args = {
        db: ctx.db,
        farmId: ctx.farmId,
        timezone: ctx.timezone,
        includeFinance: ctx.includeFinance,
    };
    const [raw, prevRaw, lowInputs] = await Promise.all([
        (0, feed_fetch_1.fetchPeriodRaw)({ ...args, cattleIds: ctx.cattleIds }, ctx.period),
        ctx.previousPeriod
            ? (0, feed_fetch_1.fetchPeriodRaw)({ ...args, cattleIds: ctx.previousCattleIds }, ctx.previousPeriod)
            : Promise.resolve(null),
        (0, feed_fetch_1.fetchLowStockInputs)(ctx.db, ctx.farmId),
    ]);
    const cur = (0, feed_aggregation_1.computePeriodFigures)(raw);
    const prev = prevRaw
        ? (0, feed_aggregation_1.computePeriodFigures)(prevRaw)
        : null;
    const lowStock = (0, feed_aggregation_1.findLowStock)(lowInputs);
    const farmWide = ctx.scopeKind === 'ALL_ELIGIBLE';
    const fw = (v) => (farmWide ? v : NOT_APPLICABLE);
    const fwPrev = (v) => farmWide ? (v ?? null) : null;
    const metrics = [
        metric('feed.recorded_actual_kg', fw(cur.actualKg), feed_definitions_1.SOURCE.recordedActual, fwPrev(prev?.actualKg), farmWide ? kgRows(cur.byItem, feed_definitions_1.SOURCE.recordedActual) : undefined),
        metric('feed.refusal_kg', fw(cur.refusalKg), feed_definitions_1.SOURCE.recordedRefusal, fwPrev(prev?.refusalKg)),
        metric('feed.offered_minus_refusal_kg', cur.offeredMinusRefusalKg, feed_definitions_1.SOURCE.offeredMinusRefusal, prev?.offeredMinusRefusalKg ?? null, kgRows(cur.byCow, feed_definitions_1.SOURCE.offeredMinusRefusal)),
    ];
    if (ctx.includeFinance) {
        metrics.push(metric('feed.distribution_cost', cur.distributionCost, feed_definitions_1.SOURCE.distributionCost, prev?.distributionCost ?? null), metric('feed.distribution_cost_known_only', cur.distributionCostKnownOnly, feed_definitions_1.SOURCE.distributionCostKnownOnly, prev?.distributionCostKnownOnly ?? null), metric('feed.distribution_cost_coverage', cur.costCoveragePct, feed_definitions_1.SOURCE.distributionCost, null), metric('feed.cost_per_cow_day', cur.costPerCowDay, feed_definitions_1.SOURCE.distributionCost, prev?.costPerCowDay ?? null), metric('feed.cost_per_litre', cur.costPerLitre, feed_definitions_1.SOURCE.distributionCost, prev?.costPerLitre ?? null));
    }
    if (ctx.includeFinance && cur.ledgerFeedSpend) {
        metrics.push(metric('feed.ledger_feed_spend', cur.ledgerFeedSpend, feed_definitions_1.SOURCE.ledgerFeed5000, prev?.ledgerFeedSpend ?? null));
    }
    metrics.push(metric('feed.fit_off_target_share', cur.fitOffTargetSharePct, feed_definitions_1.SOURCE.planFit, prev?.fitOffTargetSharePct ?? null), metric('feed.fit_estimated_cow_days', cur.fitEstimatedCowDays, feed_definitions_1.SOURCE.planFit, null), metric('feed.low_stock_items', (0, metric_value_1.valueOf)(lowStock.length, 'items'), feed_definitions_1.SOURCE.asOfGeneration, null, lowStockRows(lowStock)), metric('feed.tmr_fed_kg', fw(cur.tmrFedKg), feed_definitions_1.SOURCE.tmrFedMovements, fwPrev(prev?.tmrFedKg)));
    const exceptions = [];
    if (lowStock.length > 0) {
        exceptions.push({
            code: 'feed.low_stock_items',
            domain: 'feed',
            messageKey: 'reports.exception.feed.low_stock_items',
        });
    }
    const persistent = (0, feed_aggregation_1.persistentlyOffTarget)(raw.fitDays, feed_definitions_1.PERSISTENT_OFF_TARGET_MIN_DAYS);
    if (persistent.length > 0) {
        exceptions.push({
            code: 'feed.persistently_off_target',
            domain: 'feed',
            messageKey: 'reports.exception.feed.persistently_off_target',
            cattleIds: persistent,
        });
    }
    const dataQuality = (0, eligibility_1.buildDataQuality)({
        coverage: (0, eligibility_1.buildCoverage)(ctx.cattleIds.length *
            periodDays(ctx.period.startDate, ctx.period.endDate), cur.fedCowDays),
        hasUnknownCosts: ctx.includeFinance && cur.unknownCostRows > 0,
        hasEstimatedValues: cur.estimatedFitCowDays > 0,
        scopeEmpty: ctx.cattleIds.length === 0,
    });
    if (farmWide && ctx.cattleIds.length > 0) {
        dataQuality.notes.push(feed_definitions_1.DQ_FARM_WIDE_TOTALS);
    }
    return {
        section: {
            id: 'feed',
            domain: 'feed',
            titleKey: 'reports.section.feed',
            metrics,
        },
        exceptions,
        dataQuality,
    };
}
exports.feedMetricModule = {
    definitions: feed_definitions_1.FEED_DEFINITIONS,
    compute,
};
//# sourceMappingURL=index.js.map