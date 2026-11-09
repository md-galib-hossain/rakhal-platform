import { Prisma, Transfer } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateTransferDto } from '../presentation/dto/create-transfer.dto';
export declare class TransferService {
    private readonly prisma;
    private readonly financialAccountService;
    private readonly balanceService;
    private readonly ledgerAccountService;
    private readonly journalService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, financialAccountService: FinancialAccountService, balanceService: BalanceService, ledgerAccountService: LedgerAccountService, journalService: JournalService, activityLog: ActivityLogService, logger: LoggerService);
    createTransfer(farmId: string, userId: string, dto: CreateTransferDto, tx?: Prisma.TransactionClient): Promise<Transfer>;
    private createWithClient;
    findOne(farmId: string, id: string): Promise<Transfer>;
    findAll(farmId: string): Promise<Transfer[]>;
}
