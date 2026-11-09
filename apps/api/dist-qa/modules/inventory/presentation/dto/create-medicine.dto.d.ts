import { MedicineCategory, MedicineType } from '@prisma/client';
export declare class CreateMedicineDto {
    name: string;
    imageUrl?: string;
    type: MedicineType;
    category: MedicineCategory;
    manufacturer?: string;
    batchId?: string;
    unitId: string;
    currentStock: number;
    costPerUnit: number;
    lowStockThreshold?: number;
    purchaseDate: string;
    expiryDate: string;
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    notes?: string;
}
