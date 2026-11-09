import { PaymentMethod } from '@prisma/client';
export declare class SellManureDto {
    quantity?: number;
    unitId?: string;
    totalAmount: number;
    financialAccountId?: string;
    amountReceived?: number;
    paymentMethod?: PaymentMethod;
    saleDate: string;
    notes?: string;
}
