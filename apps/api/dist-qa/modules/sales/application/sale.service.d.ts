import { Prisma, SaleLineType, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { ReceivableStatus } from 'src/modules/finance-v2/receivables/domain/receivable-status';
import { SaleNumberAllocator } from '../infrastructure/sale-number.allocator';
import { CreateSaleDto } from '../presentation/dto/create-sale.dto';
import { ListSalesQueryDto } from '../presentation/dto/list-sales-query.dto';
declare const SALE_INCLUDE: {
    lines: {
        include: {
            unit: true;
            milkDetail: true;
            animalDetail: true;
            inventoryDetail: true;
            manureDetail: true;
        };
    };
};
export type SaleWithLines = Prisma.SaleGetPayload<{
    include: typeof SALE_INCLUDE;
}>;
export interface SaleListRow {
    id: string;
    saleNumber: string;
    saleDate: Date;
    status: SaleStatus;
    customer: {
        id: string;
        name: string;
    } | null;
    totalAmount: string;
    paidAmount: string;
    dueAmount: string;
    paymentStatus: ReceivableStatus;
    dueDate: Date | null;
    lineSummary: {
        type: SaleLineType | null;
        description: string | null;
        quantity: number;
    };
}
export declare class SaleService {
    private readonly prisma;
    private readonly saleNumberAllocator;
    private readonly log;
    constructor(prisma: PrismaService, saleNumberAllocator: SaleNumberAllocator, logger: LoggerService);
    createSale(farmId: string, userId: string, dto: CreateSaleDto, tx?: Prisma.TransactionClient): Promise<SaleWithLines>;
    private createWithClient;
    private createLineDetail;
    findOne(farmId: string, id: string): Promise<SaleWithLines>;
    findAll(farmId: string, query: ListSalesQueryDto): Promise<CursorPage<SaleListRow>>;
    private toListRow;
    private assertCustomerBelongsToFarm;
    private getOrThrow;
}
export {};
