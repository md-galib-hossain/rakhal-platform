import { FeedClass, FeedSubType } from '@prisma/client';
export declare class UpdateFeedItemDto {
    name?: string;
    currentStock?: number;
    feedClass?: FeedClass;
    feedSubType?: FeedSubType;
    ingredientId?: string;
    unitId?: string;
    kgPerUnit?: number;
    costPerUnit?: number;
    lowStockThreshold?: number;
    moisturePct?: number;
    supplier?: string;
    purchaseDate?: string;
    notes?: string;
}
