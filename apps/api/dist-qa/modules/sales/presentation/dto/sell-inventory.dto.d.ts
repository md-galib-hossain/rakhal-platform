import { PaymentMethod } from '@prisma/client';
import type { SellInventoryItemType } from '../../application/use-cases/sell-inventory/sell-inventory.types';
export declare class SellInventoryDto {
    itemType: SellInventoryItemType;
    itemId: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    notes?: string;
    saleDate: string;
    financialAccountId?: string;
    amountReceived?: number;
    paymentMethod?: PaymentMethod;
}
