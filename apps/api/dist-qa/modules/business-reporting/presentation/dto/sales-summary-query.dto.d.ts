export type SalesSummaryGranularity = 'day' | 'week' | 'month';
export declare class SalesSummaryQueryDto {
    from: string;
    to: string;
    granularity?: SalesSummaryGranularity;
}
