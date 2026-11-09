import { Expense, ExpenseCategory } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { RecordExpenseDto } from '../presentation/dto/record-expense.dto';
import { ListExpensesQueryDto } from '../presentation/dto/list-expenses-query.dto';
import { PayableService } from './payable.service';
export declare class ExpenseService {
    private readonly prisma;
    private readonly journalService;
    private readonly ledgerAccountService;
    private readonly financialAccountService;
    private readonly payableService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, journalService: JournalService, ledgerAccountService: LedgerAccountService, financialAccountService: FinancialAccountService, payableService: PayableService, activityLog: ActivityLogService, logger: LoggerService);
    resolveAccountId(farmId: string, userId: string, provided?: string | null): Promise<string>;
    recordExpense(farmId: string, userId: string, dto: RecordExpenseDto): Promise<Expense>;
    private recordWithClient;
    recordInventoryConsumption(farmId: string, userId: string, dto: {
        category: ExpenseCategory;
        description: string;
        amount: number;
        expenseDate: string;
        cattleId?: string;
    }): Promise<Expense>;
    private recordInventoryConsumptionWithClient;
    private deriveDueDate;
    findOne(farmId: string, id: string): Promise<Expense>;
    findAll(farmId: string, query: ListExpensesQueryDto): Promise<CursorPage<Expense>>;
    voidInventoryConsumption(farmId: string, expenseId: string, userId: string): Promise<void>;
    reverseExpense(farmId: string, expenseId: string, userId: string): Promise<void>;
}
