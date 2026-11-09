import type { MetricValue } from '../../../domain/contracts/metric-value';
export interface RawFeedData {
    distributions: {
        totalActualKg: number;
        totalRefusalKg: number;
        items: {
            ingredientId: string;
            ingredientName: string;
            actualKg: number;
        }[];
    }[];
    cattleItems: {
        cattleId: string;
        dayKey: string;
        offeredKg: number;
        refusalKg: number;
        costTk: number | null;
    }[];
    fitDays: {
        cattleId: string;
        date: string;
        severity: 'OK' | 'WARN' | 'BAD';
        estimated: boolean;
    }[];
    fedMovementKgs: number[];
    milk: {
        rows: number;
        litres: number;
    };
    ledgerNet: number | null;
    ledgerAccountExists: boolean;
}
export interface BreakdownRow {
    key: string;
    label: string | null;
    kg: number;
}
export interface PeriodFigures {
    actualKg: MetricValue;
    refusalKg: MetricValue;
    offeredMinusRefusalKg: MetricValue;
    distributionCost: MetricValue;
    distributionCostKnownOnly: MetricValue;
    costCoveragePct: MetricValue;
    costPerCowDay: MetricValue;
    costPerLitre: MetricValue;
    ledgerFeedSpend: MetricValue | null;
    fitOffTargetSharePct: MetricValue;
    fitEstimatedCowDays: MetricValue;
    tmrFedKg: MetricValue;
    byCow: BreakdownRow[];
    byItem: BreakdownRow[];
    costRows: number;
    unknownCostRows: number;
    fedCowDays: number;
    estimatedFitCowDays: number;
}
export declare const round2: (n: number) => number;
export declare function computePeriodFigures(raw: RawFeedData): PeriodFigures;
export interface LowStockInput {
    id: string;
    name: string;
    unit: string;
    threshold: number;
    batchStocks: number[];
}
export interface LowStockItem {
    id: string;
    name: string;
    unit: string;
    stock: number;
    threshold: number;
}
export declare function findLowStock(items: readonly LowStockInput[]): LowStockItem[];
export declare function persistentlyOffTarget(days: readonly {
    cattleId: string;
    date: string;
    severity: 'OK' | 'WARN' | 'BAD';
    estimated: boolean;
}[], minDays: number | null): string[];
