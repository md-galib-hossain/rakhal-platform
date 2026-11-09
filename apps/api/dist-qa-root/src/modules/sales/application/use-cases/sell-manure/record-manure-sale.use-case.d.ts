import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SaleService, SaleWithLines } from '../../sale.service';
import { RecordManureSaleInput } from './record-manure-sale.input';
export interface RecordManureSaleResult {
    sale: SaleWithLines;
    receivableId: string;
    paymentId: string | null;
}
export declare class RecordManureSaleUseCase {
    private readonly prisma;
    private readonly saleService;
    private readonly receivableService;
    private readonly paymentService;
    private readonly ledgerAccountService;
    private readonly journalService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, saleService: SaleService, receivableService: ReceivableService, paymentService: PaymentService, ledgerAccountService: LedgerAccountService, journalService: JournalService, activityLog: ActivityLogService, logger: LoggerService);
    execute(farmId: string, userId: string, dto: RecordManureSaleInput): Promise<RecordManureSaleResult>;
}
