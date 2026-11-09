export interface AgingBucketDef {
    key: 'CURRENT' | 'OVERDUE_8_30' | 'OVERDUE_31_PLUS';
    label: string;
    minDays: number;
    maxDays: number | null;
}
export declare const RECEIVABLE_AGING_BUCKETS: readonly AgingBucketDef[];
export declare function buildAgingBucketCaseSql(daysExpr: string): string;
