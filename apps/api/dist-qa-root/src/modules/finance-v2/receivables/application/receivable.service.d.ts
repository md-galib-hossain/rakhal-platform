import { Prisma, Receivable } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { ReceivableStatus } from '../domain/receivable-status';
import { ListReceivablesQueryDto } from '../presentation/dto/list-receivables-query.dto';
export type ReceivableWithDerived = Receivable & {
    outstanding: string;
    status: ReceivableStatus;
};
export declare class ReceivableService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    createReceivable(farmId: string, saleId: string, totalAmount: Prisma.Decimal.Value, dueDate?: Date | null, tx?: Prisma.TransactionClient, customerId?: string | null): Promise<Receivable>;
    getOutstanding(farmId: string, receivableId: string, tx?: Prisma.TransactionClient): Promise<Prisma.Decimal>;
    getStatus(farmId: string, receivableId: string, tx?: Prisma.TransactionClient): Promise<ReceivableStatus>;
    assertWithinOutstanding(farmId: string, receivableId: string, amount: Prisma.Decimal.Value, tx?: Prisma.TransactionClient): Promise<void>;
    closeIfSettled(farmId: string, receivableId: string, tx?: Prisma.TransactionClient): Promise<void>;
    findOne(farmId: string, receivableId: string): Promise<ReceivableWithDerived>;
    listReceivables(farmId: string, query: ListReceivablesQueryDto): Promise<CursorPage<ReceivableWithDerived>>;
    private getFigures;
    private computeOutstanding;
    private deriveStatus;
}
