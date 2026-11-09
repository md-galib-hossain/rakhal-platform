import { NutritionInputDto } from './nutrition-input.dto';
export declare class CreateFeedItemBatchDto {
    currentStock: number;
    costPerUnit: number;
    purchaseDate: string;
    batchCode?: string;
    notes?: string;
    nutrition?: NutritionInputDto;
    copyFromIngredientId?: string;
}
