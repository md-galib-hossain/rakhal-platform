export type TrendBucket = 'day' | 'week' | 'month';
export interface TrendPoint {
    date: string;
    count: number;
}
export declare function pickBucket(spanDays: number): TrendBucket;
export declare function buildTrend(dates: Date[], from: Date, to: Date): {
    bucket: TrendBucket;
    points: TrendPoint[];
};
