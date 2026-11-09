import { FeedConcentrationKind, FeedTargetType, PaymentMethod } from '@prisma/client';
export declare class ListConcentrationsQueryDto {
    kind?: FeedConcentrationKind;
    includeArchived: boolean;
}
export declare class ConcentrationItemDto {
    ingredientId?: string;
    amountKg: number;
    feedItemId?: string;
    feedItemBatchId?: string;
    feedStockId?: string;
}
export declare class CreateConcentrationDto {
    kind: FeedConcentrationKind;
    name: string;
    durationDays?: number;
    targetType?: FeedTargetType;
    cattleId?: string;
    targetWeightKg?: number;
    targetMilkL?: number;
    items: ConcentrationItemDto[];
}
export declare class FinalizeConcentrationDto {
    paymentMethod?: PaymentMethod;
    financialAccountId?: string;
    batchQuantityKg?: number;
}
export declare class UpdateConcentrationDto {
    name?: string;
    durationDays?: number;
    targetType?: FeedTargetType;
    cattleId?: string;
    targetWeightKg?: number;
    targetMilkL?: number;
    items?: ConcentrationItemDto[];
}
export declare class BulkDeleteConcentrationDto {
    ids: string[];
}
export declare class NormalizeConcentrationDto {
    weightKg: number;
    milkTargetL: number;
    milkFatPct?: number;
    items: ConcentrationItemDto[];
}
