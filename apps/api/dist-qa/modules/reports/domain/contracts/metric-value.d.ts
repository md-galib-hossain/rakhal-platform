import type { MetricId } from './metric-definition';
export type MetricValue = {
    state: 'value';
    value: number;
    unit: string;
} | {
    state: 'missing';
    reason: string;
} | {
    state: 'not_calculated';
    reason: string;
} | {
    state: 'not_applicable';
};
export declare const valueOf: (value: number, unit: string) => MetricValue;
export interface Comparison {
    current: MetricValue;
    previous: MetricValue;
    absoluteChange: number | null;
    percentChange: number | null;
    previousState: MetricValue['state'];
}
export interface SeriesPoint {
    key: string;
    value: MetricValue;
}
export interface BreakdownRow {
    key: string;
    label: string | null;
    value: MetricValue;
    source: string | null;
}
export interface MetricResult {
    metricId: MetricId;
    value: MetricValue;
    source: string | null;
    comparison: Comparison | null;
    series?: SeriesPoint[];
    rows?: BreakdownRow[];
    requiresPermission: string | null;
}
export declare function safePercentChange(current: number, previous: number): number | null;
export declare function compareMetric(current: MetricValue, previous: MetricValue): Comparison;
