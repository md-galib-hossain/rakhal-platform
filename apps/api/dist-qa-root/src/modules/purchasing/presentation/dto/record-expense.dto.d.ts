import { ExpenseCategory } from '@prisma/client';
export declare class RecordExpenseDto {
    category: ExpenseCategory;
    description: string;
    amount: number;
    expenseDate: string;
    financialAccountId?: string;
    dueDate?: string;
    supplierId?: string;
    notes?: string;
    cattleId?: string;
}
