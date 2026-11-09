import { FeedClass, FeedSubType } from '@prisma/client';
import { NutritionInputDto } from './nutrition-input.dto';
export declare class CreateFeedItemDto {
    name: string;
    feedClass: FeedClass;
    feedSubType?: FeedSubType;
    ingredientId?: string;
    nutrition?: NutritionInputDto;
    batchCode?: string;
    unitId: string;
    kgPerUnit?: number;
    currentStock: number;
    costPerUnit: number;
    lowStockThreshold?: number;
    moisturePct?: number;
    supplier?: string;
    purchaseDate: string;
    notes?: string;
}
