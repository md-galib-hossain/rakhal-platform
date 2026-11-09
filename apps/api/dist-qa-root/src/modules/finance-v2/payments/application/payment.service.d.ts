import { FinancePayment, PaymentAllocation, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PayableService } from 'src/modules/purchasing/application/payable.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreatePaymentDto } from '../presentation/dto/create-payment.dto';
import { AllocatePaymentLineDto } from '../presentation/dto/allocate-payment.dto';
export type FinancePaymentWithAllocations = FinancePayment & {
    allocations: PaymentAllocation[];
};
export declare class PaymentService {
    private readonly prisma;
    private readonly financialAccountService;
    private readonly ledgerAccountService;
    private readonly journalService;
    private readonly receivableService;
    private readonly payableService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, financialAccountService: FinancialAccountService, ledgerAccountService: LedgerAccountService, journalService: JournalService, receivableService: ReceivableService, payableService: PayableService, activityLog: ActivityLogService, logger: LoggerService);
    recordPayment(farmId: string, userId: string, dto: CreatePaymentDto, tx?: Prisma.TransactionClient): Promise<FinancePayment>;
    private recordWithClient;
    allocatePayment(farmId: string, paymentId: string, lines: AllocatePaymentLineDto[], tx?: Prisma.TransactionClient): Promise<PaymentAllocation[]>;
    private allocateWithClient;
    findOne(farmId: string, id: string): Promise<FinancePaymentWithAllocations>;
    findAll(farmId: string): Promise<FinancePayment[]>;
}
