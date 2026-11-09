import { EquipmentStockMovementReason } from '@prisma/client';
export declare class AdjustEquipmentStockDto {
    adjustment: number;
    reason: EquipmentStockMovementReason;
    notes?: string;
    saleLineId?: string;
}
