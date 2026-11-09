import { MedicineStockMovementReason } from '@prisma/client';
export declare class AdjustStockDto {
    adjustment: number;
    reason: MedicineStockMovementReason;
    notes?: string;
    saleLineId?: string;
}
