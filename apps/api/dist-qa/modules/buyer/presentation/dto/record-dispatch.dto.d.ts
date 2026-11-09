import { PaymentMethod } from '@prisma/client';
export declare class RecordDispatchDto {
    buyerId: string;
    dispatchedAt: string;
    volumeDispatchedL: number;
    volumeReceivedL?: number;
    fatPct?: number;
    scc?: number;
    notes?: string;
    driverName?: string;
    amountReceived?: number;
    paymentMethod?: PaymentMethod;
    financialAccountId?: string;
    referenceNumber?: string;
}
