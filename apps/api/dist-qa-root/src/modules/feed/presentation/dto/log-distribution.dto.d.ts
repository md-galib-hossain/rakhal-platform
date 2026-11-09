export declare class DistributionItemDto {
    ingredientId: string;
    actualKg?: number;
    refusalKg?: number;
    stockId?: string;
}
export declare class LogDistributionDto {
    concentrationId: string;
    distributedAt?: string;
    notes?: string;
    items?: DistributionItemDto[];
}
