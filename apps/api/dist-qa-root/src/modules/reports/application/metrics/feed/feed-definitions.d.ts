import type { MetricDefinition } from '../../../domain/contracts/metric-definition';
export declare const FEED_CALC_VERSION = 1;
export declare const MAX_BREAKDOWN_ROWS = 50;
export declare const PERSISTENT_OFF_TARGET_MIN_DAYS: number | null;
export declare const DQ_FARM_WIDE_TOTALS = "reports.dq.feed_farm_wide_totals";
export declare const SOURCE: {
    readonly recordedActual: "recordedActual";
    readonly recordedRefusal: "recordedRefusal";
    readonly offeredMinusRefusal: "offeredMinusRefusal";
    readonly distributionCost: "distributionCost";
    readonly distributionCostKnownOnly: "distributionCostKnownOnly";
    readonly ledgerFeed5000: "ledgerFeed5000";
    readonly planFit: "feedPlanFitDay";
    readonly asOfGeneration: "asOfGeneration";
    readonly tmrFedMovements: "feedStockMovementFed";
    readonly derived: "derived";
};
export declare const FEED_DEFINITIONS: readonly MetricDefinition[];
