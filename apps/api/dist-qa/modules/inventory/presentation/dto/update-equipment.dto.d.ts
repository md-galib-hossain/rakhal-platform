import { EquipmentType } from '@prisma/client';
export declare class UpdateEquipmentDto {
    name?: string;
    assetId?: string;
    type?: EquipmentType;
    unitId?: string;
    currentStock?: number;
    costPerUnit?: number;
    lowStockThreshold?: number;
    purchaseDate?: string;
    notes?: string;
}
