import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CattleService } from 'src/modules/cattle/application/services/cattle.service';
import { SaleService } from 'src/modules/sales/application/sale.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SellAnimalInput, SellAnimalResult } from './sell-animal.types';
export declare class SellAnimalUseCase {
    private readonly prisma;
    private readonly cattleService;
    private readonly saleService;
    private readonly receivableService;
    private readonly paymentService;
    private readonly ledgerAccountService;
    private readonly journalService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, cattleService: CattleService, saleService: SaleService, receivableService: ReceivableService, paymentService: PaymentService, ledgerAccountService: LedgerAccountService, journalService: JournalService, activityLog: ActivityLogService, logger: LoggerService);
    execute(farmId: string, userId: string, cattleId: string, dto: SellAnimalInput): Promise<SellAnimalResult>;
}
