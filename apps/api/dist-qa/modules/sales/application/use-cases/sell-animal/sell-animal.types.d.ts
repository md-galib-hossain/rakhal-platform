import { PaymentMethod } from '@prisma/client';
export interface SellAnimalInput {
    salePrice: number;
    buyerName?: string;
    buyerId?: string;
    financialAccountId?: string;
    paymentMethod?: PaymentMethod;
    amountReceived?: number;
    saleDate: string;
}
export interface SellAnimalResult {
    saleId: string;
    saleNumber: string;
    totalAmount: string;
    dispositionId: string;
    receivableId: string;
    paymentId: string | null;
    journalTransactionId: string;
}
