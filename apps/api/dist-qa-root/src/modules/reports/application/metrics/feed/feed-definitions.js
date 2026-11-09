"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEED_DEFINITIONS = exports.SOURCE = exports.DQ_FARM_WIDE_TOTALS = exports.PERSISTENT_OFF_TARGET_MIN_DAYS = exports.MAX_BREAKDOWN_ROWS = exports.FEED_CALC_VERSION = void 0;
exports.FEED_CALC_VERSION = 1;
exports.MAX_BREAKDOWN_ROWS = 50;
exports.PERSISTENT_OFF_TARGET_MIN_DAYS = null;
exports.DQ_FARM_WIDE_TOTALS = 'reports.dq.feed_farm_wide_totals';
exports.SOURCE = {
    recordedActual: 'recordedActual',
    recordedRefusal: 'recordedRefusal',
    offeredMinusRefusal: 'offeredMinusRefusal',
    distributionCost: 'distributionCost',
    distributionCostKnownOnly: 'distributionCostKnownOnly',
    ledgerFeed5000: 'ledgerFeed5000',
    planFit: 'feedPlanFitDay',
    asOfGeneration: 'asOfGeneration',
    tmrFedMovements: 'feedStockMovementFed',
    derived: 'derived',
};
const base = (id, unit, formula, eligibilityRule, missingDataRule, extra = {}) => ({
    id,
    domain: 'feed',
    unit,
    formula,
    eligibilityRule,
    missingDataRule,
    calcVersion: exports.FEED_CALC_VERSION,
    ...extra,
});
exports.FEED_DEFINITIONS = [
    base('feed.recorded_actual_kg', 'kg', 'sum(FeedDistribution.totalActualKg) (farm/ration level, recorded actual). rows: per ingredient, largest first, capped', 'non-voided distributions with distributedAt in period; farm-wide (ignores cow scope), not cow-scoped', 'state=missing when no distribution recorded (never 0)'),
    base('feed.refusal_kg', 'kg', 'sum(FeedDistribution.totalRefusalKg) (farm/ration level)', 'non-voided distributions in period; farm-wide (ignores cow scope)', 'state=missing when no distribution recorded'),
    base('feed.offered_minus_refusal_kg', 'kg', 'sum(FeedDistributionCattleItem.offeredKg - refusalKg). NOT recorded intake. rows: per cow, largest first, capped', 'non-voided cow rows for in-scope cows in period', 'state=missing when no cow rows; cows with no row are absent from rows'),
    base('feed.distribution_cost', 'BDT', 'sum(FeedDistributionCattleItem.costTk)', 'non-voided cow rows for in-scope cows in period', 'state=missing when any row costTk is null (unknown) or no rows; never summed as 0', { requiresPermission: 'finance.read' }),
    base('feed.distribution_cost_known_only', 'BDT', 'sum(costTk) over rows where costTk is known (partial; see coverage)', 'same rows as distribution_cost', 'state=missing when no rows have a known cost', { requiresPermission: 'finance.read' }),
    base('feed.distribution_cost_coverage', '%', 'rows with costTk / all rows * 100', 'same rows as distribution_cost', 'state=missing when no rows', { requiresPermission: 'finance.read' }),
    base('feed.cost_per_cow_day', 'BDT/cow-day', 'distribution_cost / distinct (cow, farm-local day) with a feed row', 'requires distribution_cost to be a value and cow-days > 0', 'not_calculated when numerator or denominator is not a real value', { requiresPermission: 'finance.read' }),
    base('feed.cost_per_litre', 'BDT/L', 'distribution_cost / sum(MilkLogEntry.yieldL, submitted=true, in-scope cows, logDate in period)', 'requires distribution_cost to be a value and litres > 0', 'not_calculated when numerator or litres are missing', { requiresPermission: 'finance.read' }),
    base('feed.ledger_feed_spend', 'BDT', 'ledger account 5000 (Feed) net debit over journal transactionDate in period. Separate from distribution cost', 'farm ledger, farm-wide', 'absent when finance not included', { requiresPermission: 'finance.read' }),
    base('feed.fit_off_target_share', '%', '(WARN+BAD) / all non-estimated FeedPlanFitDay cow-days * 100', 'fit days of in-scope cows in period, estimated rows excluded', 'state=missing when no non-estimated fit days'),
    base('feed.fit_estimated_cow_days', 'cow-days', 'count(FeedPlanFitDay where estimated=true)', 'fit days of in-scope cows in period', 'state=missing when no fit days'),
    base('feed.low_stock_items', 'items', 'count(FeedItem with lowStockThreshold>0 and sum(live batch stock) <= threshold). Current state as of generation. rows: per low item (value = stock in its own unit)', 'live feed items of the farm; NOT period-based', 'value 0 when none are low'),
    base('feed.tmr_fed_kg', 'kg', '-sum(FeedStockMovement.changeKg) where reason in (FED, ADJUSTMENT) and distributionId is a non-voided distribution in period', 'movements of the farm TMR/concentrate stock lots', 'state=missing when no FED movements; voided feedings net out via their compensating ADJUSTMENT rows. Farm-wide (ignores cow scope), not_applicable unless scope is all eligible cows'),
];
//# sourceMappingURL=feed-definitions.js.map