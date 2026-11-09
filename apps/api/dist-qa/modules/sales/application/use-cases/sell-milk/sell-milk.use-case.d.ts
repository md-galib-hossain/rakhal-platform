import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { MilkTankService } from 'src/modules/inventory/application/services/milk-tank.service';
import { MilkAvailabilityService } from 'src/modules/milk/application/services/milk-availability.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SaleService } from '../../sale.service';
import { SellMilkInput, SellMilkResult } from './sell-milk.types';
export declare class SellMilkUseCase {
    private readonly prisma;
    private readonly saleService;
    private readonly milkTankService;
    private readonly milkAvailabilityService;
    private readonly ledgerAccountService;
    private readonly journalService;
    private readonly receivableService;
    private readonly paymentService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, saleService: SaleService, milkTankService: MilkTankService, milkAvailabilityService: MilkAvailabilityService, ledgerAccountService: LedgerAccountService, journalService: JournalService, receivableService: ReceivableService, paymentService: PaymentService, activityLog: ActivityLogService, logger: LoggerService);
    execute(farmId: string, userId: string, input: SellMilkInput, tx?: Prisma.TransactionClient): Promise<SellMilkResult>;
    private executeWithClient;
    private decrementSellableTank;
    private deriveDueDate;
}
