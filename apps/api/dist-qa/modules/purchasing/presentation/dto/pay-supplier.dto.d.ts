import { PaymentMethod } from '@prisma/client';
export declare class PaySupplierDto {
    financialAccountId?: string;
    amount: number;
    method: PaymentMethod;
    transactionDate: string;
    referenceNumber?: string;
}
