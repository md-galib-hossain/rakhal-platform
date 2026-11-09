import { PaymentDirection, PaymentMethod } from '@prisma/client';
export declare class CreatePaymentDto {
    direction: PaymentDirection;
    financialAccountId?: string;
    amount: number;
    method: PaymentMethod;
    transactionDate: string;
    referenceNumber?: string;
    notes?: string;
}
