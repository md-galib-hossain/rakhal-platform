import { Expense } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { EquipmentService } from 'src/modules/inventory/application/services/equipment.service';
import { PurchaseService, PurchaseWithLines } from '../../purchase.service';
export declare class VoidDocumentUseCase {
    private readonly prisma;
    private readonly purchaseService;
    private readonly journalService;
    private readonly medicineService;
    private readonly feedItemService;
    private readonly equipmentService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, purchaseService: PurchaseService, journalService: JournalService, medicineService: MedicineService, feedItemService: FeedItemService, equipmentService: EquipmentService, activityLog: ActivityLogService, logger: LoggerService);
    private recordVoidActivity;
    voidPurchase(farmId: string, userId: string, purchaseId: string): Promise<PurchaseWithLines>;
    voidExpense(farmId: string, userId: string, expenseId: string): Promise<Expense>;
    private reverseJournalFor;
}
