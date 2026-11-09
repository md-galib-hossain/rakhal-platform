import { IncomeCategory, OtherIncome, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateIncomeCategoryDto } from '../presentation/dto/create-income-category.dto';
import { RecordOtherIncomeDto } from '../presentation/dto/record-other-income.dto';
export declare class IncomeService {
    private readonly prisma;
    private readonly financialAccountService;
    private readonly ledgerAccountService;
    private readonly journalService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, financialAccountService: FinancialAccountService, ledgerAccountService: LedgerAccountService, journalService: JournalService, activityLog: ActivityLogService, logger: LoggerService);
    listCategories(farmId: string): Promise<IncomeCategory[]>;
    createCategory(farmId: string, dto: CreateIncomeCategoryDto): Promise<IncomeCategory>;
    recordOtherIncome(farmId: string, userId: string, dto: RecordOtherIncomeDto, tx?: Prisma.TransactionClient): Promise<OtherIncome>;
    private recordWithClient;
    findOne(farmId: string, id: string): Promise<OtherIncome>;
    findAll(farmId: string): Promise<OtherIncome[]>;
}
