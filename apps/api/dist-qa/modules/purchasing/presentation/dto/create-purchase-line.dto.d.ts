import { PurchaseNewItemDto } from './purchase-new-item.dto';
export declare class CreatePurchaseLineDto {
    medicineId?: string;
    feedItemId?: string;
    equipmentId?: string;
    newItem?: PurchaseNewItemDto;
    quantity: number;
    unitCost: number;
    expiryDate?: string;
    batchCode?: string;
}
