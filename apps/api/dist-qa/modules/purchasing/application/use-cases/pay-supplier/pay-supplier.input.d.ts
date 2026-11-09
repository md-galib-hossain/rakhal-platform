import { PaymentMethod } from '@prisma/client';
export interface PaySupplierInput {
    payableId: string;
    financialAccountId?: string;
    amount: number;
    method: PaymentMethod;
    transactionDate: string;
    referenceNumber?: string;
}
