import { DailyYieldPoint } from './lactation-curve';
export interface DimAlignedPoint {
    dim: number;
    currentYieldL: number | null;
    previousYieldL: number | null;
}
export declare function alignSeriesByDim(current: DailyYieldPoint[], previous: DailyYieldPoint[]): DimAlignedPoint[];
export type LactationComparisonGroupBy = 'parity' | 'shed' | 'dimRange';
export declare const DIM_RANGE_BUCKETS: {
    key: string;
    label: string;
    min: number;
    max: number | null;
}[];
export declare function dimRangeBucketKey(dim: number): string;
export declare function dimRangeBucketLabel(key: string): string;
export declare function parityBucketKey(lactationNumber: number): string;
export interface LactationGroupSnapshot {
    cattleId: string;
    lactationId: string;
    bucketKey: string;
    bucketLabel: string;
    dim: number;
    sevenDayAvgYield: number;
    peakMilkYield: number | null;
    persistencyPct: number | null;
}
export interface LactationGroupBucketResult {
    bucketKey: string;
    bucketLabel: string;
    cowCount: number;
    avgDim: number;
    avgSevenDayYield: number;
    avgPeakMilkYield: number | null;
    avgPersistencyPct: number | null;
}
export declare function aggregateByBucket(snapshots: LactationGroupSnapshot[]): LactationGroupBucketResult[];
