import { SaleLineType } from '@prisma/client';
export interface SaleLineDetailInput {
    type: SaleLineType;
    cattleId?: string | null;
    medicineId?: string | null;
    feedItemId?: string | null;
    equipmentId?: string | null;
}
export declare function validateSaleLineDetailShape(line: SaleLineDetailInput): string | null;
