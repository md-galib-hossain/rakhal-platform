import { TransferService } from '../../application/transfer.service';
export declare class TransferController {
    private readonly transfers;
    constructor(transfers: TransferService);
    create(): never;
    findAll(farmId: string): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        amount: import("@prisma/client/runtime/client").Decimal;
        notes: string | null;
        transactionDate: Date;
        createdById: string;
        fromFinancialAccountId: string;
        toFinancialAccountId: string;
        feeAmount: import("@prisma/client/runtime/client").Decimal;
    }[]>;
    findOne(farmId: string, id: string): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        amount: import("@prisma/client/runtime/client").Decimal;
        notes: string | null;
        transactionDate: Date;
        createdById: string;
        fromFinancialAccountId: string;
        toFinancialAccountId: string;
        feeAmount: import("@prisma/client/runtime/client").Decimal;
    }>;
}
