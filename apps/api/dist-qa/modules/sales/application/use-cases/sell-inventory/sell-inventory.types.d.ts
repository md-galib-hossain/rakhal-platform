import { FinancePayment, PaymentMethod, Receivable } from '@prisma/client';
import { SaleWithLines } from '../../sale.service';
export type SellInventoryItemType = 'MEDICINE' | 'FEED_ITEM' | 'EQUIPMENT';
export interface SellInventoryItemInput {
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
export interface SellInventoryItemResult {
    sale: SaleWithLines;
    receivable: Receivable;
    payment: FinancePayment | null;
}
