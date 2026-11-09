import { ExpenseService } from '../../application/expense.service';
import { VoidDocumentUseCase } from '../../application/use-cases/void-document/void-document.use-case';
import { RecordExpenseDto } from '../dto/record-expense.dto';
import { ListExpensesQueryDto } from '../dto/list-expenses-query.dto';
export declare class ExpenseController {
    private readonly expenses;
    private readonly voidDocument;
    constructor(expenses: ExpenseService, voidDocument: VoidDocumentUseCase);
    create(farmId: string, userId: string, dto: RecordExpenseDto): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        description: string;
        amount: import("@prisma/client/runtime/client").Decimal;
        cattleId: string | null;
        notes: string | null;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        createdById: string;
        financialAccountId: string | null;
        supplierId: string | null;
        expenseDate: Date;
        voidedAt: Date | null;
    }>;
    findAll(farmId: string, query: ListExpensesQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        farmId: string;
        id: string;
        createdAt: Date;
        description: string;
        amount: import("@prisma/client/runtime/client").Decimal;
        cattleId: string | null;
        notes: string | null;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        createdById: string;
        financialAccountId: string | null;
        supplierId: string | null;
        expenseDate: Date;
        voidedAt: Date | null;
    }>>;
    findOne(farmId: string, id: string): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        description: string;
        amount: import("@prisma/client/runtime/client").Decimal;
        cattleId: string | null;
        notes: string | null;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        createdById: string;
        financialAccountId: string | null;
        supplierId: string | null;
        expenseDate: Date;
        voidedAt: Date | null;
    }>;
    void(farmId: string, userId: string, id: string): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        description: string;
        amount: import("@prisma/client/runtime/client").Decimal;
        cattleId: string | null;
        notes: string | null;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        createdById: string;
        financialAccountId: string | null;
        supplierId: string | null;
        expenseDate: Date;
        voidedAt: Date | null;
    }>;
}
