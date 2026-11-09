import { PaymentMethod } from '@prisma/client';
export interface RecordManureSaleInput {
    quantity?: number;
    unitId?: string;
    totalAmount: number;
    financialAccountId?: string;
    amountReceived?: number;
    paymentMethod?: PaymentMethod;
    saleDate: string;
    notes?: string;
}
