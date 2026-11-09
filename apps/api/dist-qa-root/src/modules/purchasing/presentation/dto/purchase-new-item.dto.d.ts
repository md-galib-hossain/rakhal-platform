import { EquipmentType, FeedClass, FeedSubType, MedicineCategory, MedicineType } from '@prisma/client';
import { NutritionInputDto } from 'src/modules/inventory/presentation/dto/nutrition-input.dto';
import type { PurchaseNewItemKind } from '../../domain/purchase-line-shape';
export declare class PurchaseNewItemDto {
    kind: PurchaseNewItemKind;
    name: string;
    unitId?: string;
    lowStockThreshold?: number;
    notes?: string;
    medicineType?: MedicineType;
    medicineCategory?: MedicineCategory;
    manufacturer?: string;
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    feedClass?: FeedClass;
    feedSubType?: FeedSubType;
    ingredientId?: string;
    nutrition?: NutritionInputDto;
    kgPerUnit?: number;
    equipmentType?: EquipmentType;
    assetId?: string;
}
