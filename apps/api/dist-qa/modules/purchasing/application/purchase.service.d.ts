import { Prisma, Purchase } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { EquipmentService } from 'src/modules/inventory/application/services/equipment.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { PurchasePayment } from '../domain/purchase-payment';
import { PurchaseNumberAllocator } from '../infrastructure/purchase-number.allocator';
import { CreatePurchaseDto } from '../presentation/dto/create-purchase.dto';
import { ListPurchasesQueryDto } from '../presentation/dto/list-purchases-query.dto';
import { PayableService } from './payable.service';
declare const PURCHASE_INCLUDE: {
    lines: true;
    payable: true;
};
export type PurchaseWithLines = Prisma.PurchaseGetPayload<{
    include: typeof PURCHASE_INCLUDE;
}>;
export type PurchaseListRow = Purchase & {
    _count: {
        lines: number;
    };
} & PurchasePayment;
export declare class PurchaseService {
    private readonly prisma;
    private readonly purchaseNumberAllocator;
    private readonly journalService;
    private readonly ledgerAccountService;
    private readonly financialAccountService;
    private readonly medicineService;
    private readonly feedItemService;
    private readonly equipmentService;
    private readonly payableService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, purchaseNumberAllocator: PurchaseNumberAllocator, journalService: JournalService, ledgerAccountService: LedgerAccountService, financialAccountService: FinancialAccountService, medicineService: MedicineService, feedItemService: FeedItemService, equipmentService: EquipmentService, payableService: PayableService, activityLog: ActivityLogService, logger: LoggerService);
    createPurchase(farmId: string, userId: string, dto: CreatePurchaseDto): Promise<PurchaseWithLines>;
    private createWithClient;
    private createLineAndIncrementStock;
    private createNewItem;
    findOne(farmId: string, id: string): Promise<PurchaseWithLines>;
    findAll(farmId: string, query: ListPurchasesQueryDto): Promise<CursorPage<PurchaseListRow>>;
    private deriveDueDate;
    private getOrThrow;
}
export {};
