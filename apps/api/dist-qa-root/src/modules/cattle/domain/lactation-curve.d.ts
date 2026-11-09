export interface DailyYield {
    date: Date;
    totalL: number;
}
export interface LactationCurvePoint {
    dim: number;
    yield_l: number;
}
export declare function daysBetween(start: Date, end: Date): number;
export declare function buildLactationCurve(lactationStart: Date, dailyYields: DailyYield[]): LactationCurvePoint[];
export declare function trendPct(current: number, previous: number): number | null;
