import { BankAccountDetail, FinancialAccount, MfsAccountDetail, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateFinancialAccountDto } from '../presentation/dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from '../presentation/dto/update-financial-account.dto';
export type FinancialAccountWithDetail = FinancialAccount & {
    bankDetail: BankAccountDetail | null;
    mfsDetail: MfsAccountDetail | null;
};
export declare class FinancialAccountService {
    private readonly prisma;
    private readonly ledgerAccountService;
    private readonly journalService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, ledgerAccountService: LedgerAccountService, journalService: JournalService, activityLog: ActivityLogService, logger: LoggerService);
    createAccount(farmId: string, userId: string, dto: CreateFinancialAccountDto, tx?: Prisma.TransactionClient): Promise<FinancialAccountWithDetail>;
    private createWithClient;
    private postOpeningBalance;
    setOpeningBalance(farmId: string, id: string, userId: string, amount: number): Promise<FinancialAccountWithDetail>;
    resolveFarmAccount(farmId: string, userId: string, tx?: Prisma.TransactionClient): Promise<FinancialAccountWithDetail>;
    resolveFarmAccountId(farmId: string, userId: string, provided?: string | null, tx?: Prisma.TransactionClient): Promise<string>;
    findAll(farmId: string, includeArchived?: boolean): Promise<FinancialAccountWithDetail[]>;
    findOne(farmId: string, id: string): Promise<FinancialAccountWithDetail>;
    updateAccount(farmId: string, id: string, dto: UpdateFinancialAccountDto): Promise<FinancialAccountWithDetail>;
    setPrimary(farmId: string, id: string, userId?: string): Promise<FinancialAccountWithDetail>;
    archiveAccount(farmId: string, id: string, userId?: string): Promise<FinancialAccountWithDetail>;
    assertAccountActive(farmId: string, id: string): Promise<void>;
    private nextCustomLedgerCode;
    private getOrThrow;
}
