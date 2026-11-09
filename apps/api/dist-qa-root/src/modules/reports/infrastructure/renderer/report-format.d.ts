import type { MetricValue } from '../../domain/contracts/metric-value';
export declare const TEXT_MISSING = "Not recorded";
export declare const TEXT_NOT_CALCULATED = "Not calculated";
export declare const TEXT_NOT_APPLICABLE = "\u2014";
export declare const TAKA = "\u09F3";
export declare function formatNumber(n: number): string;
export interface FormattedValue {
    state: MetricValue['state'];
    text: string;
    unit: string;
    detail?: string;
}
export declare function formatValue(v: MetricValue): FormattedValue;
export declare function formatFull(v: MetricValue): string;
export interface DeltaText {
    text: string;
    direction: 'up' | 'down' | 'flat' | 'none';
}
export declare function formatPercentChange(pct: number | null): DeltaText;
export declare const monthName: (m1: number) => string;
export declare function parseYmd(s: string): {
    y: number;
    m: number;
    d: number;
} | null;
export declare function shortDate(s: string): string;
export declare function formatRange(start: string, end: string): string;
export declare function daysBetweenInclusive(start: string, end: string): number | null;
export declare function formatInstant(iso: string, timeZone: string): string;
export declare function stripControl(s: string): string;
export declare function clampText(s: unknown, max?: number): string;
