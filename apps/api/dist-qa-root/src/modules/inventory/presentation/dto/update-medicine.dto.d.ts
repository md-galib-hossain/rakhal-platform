import { MedicineCategory, MedicineType } from '@prisma/client';
export declare class UpdateMedicineDto {
    name?: string;
    imageUrl?: string;
    type?: MedicineType;
    category?: MedicineCategory;
    manufacturer?: string;
    batchId?: string;
    unitId?: string;
    costPerUnit?: number;
    lowStockThreshold?: number;
    purchaseDate?: string;
    expiryDate?: string;
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    notes?: string;
}
