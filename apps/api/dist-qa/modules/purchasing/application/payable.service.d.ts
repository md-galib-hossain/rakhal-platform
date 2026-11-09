import { Payable, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { PayableStatus } from '../domain/payable-status';
import { ListPayablesQueryDto } from '../presentation/dto/list-payables-query.dto';
export type PayableWithDerived = Payable & {
    outstanding: string;
    status: PayableStatus;
};
export declare class PayableService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    createPayable(farmId: string, params: {
        purchaseId?: string | null;
        expenseId?: string | null;
        supplierId?: string | null;
        totalAmount: Prisma.Decimal.Value;
        dueDate?: Date | null;
    }, tx?: Prisma.TransactionClient): Promise<Payable>;
    getOutstanding(farmId: string, payableId: string, tx?: Prisma.TransactionClient): Promise<Prisma.Decimal>;
    getStatus(farmId: string, payableId: string, tx?: Prisma.TransactionClient): Promise<PayableStatus>;
    assertWithinOutstanding(farmId: string, payableId: string, amount: Prisma.Decimal.Value, tx?: Prisma.TransactionClient): Promise<void>;
    closeIfSettled(farmId: string, payableId: string, tx?: Prisma.TransactionClient): Promise<void>;
    findOne(farmId: string, payableId: string): Promise<PayableWithDerived>;
    listPayables(farmId: string, query: ListPayablesQueryDto): Promise<CursorPage<PayableWithDerived>>;
    private getFigures;
    private computeOutstanding;
    private deriveStatus;
}
