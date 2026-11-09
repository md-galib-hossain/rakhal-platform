import { SaleLineType } from '@prisma/client';
export declare class CreateSaleLineDto {
    type: SaleLineType;
    description: string;
    quantity: number;
    unitId?: string;
    unitPrice: number;
    cattleId?: string;
    medicineId?: string;
    feedItemId?: string;
    equipmentId?: string;
    manureNotes?: string;
}
