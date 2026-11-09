import { IncomeService } from '../../application/income.service';
import { CreateIncomeCategoryDto } from '../dto/create-income-category.dto';
import { RecordOtherIncomeDto } from '../dto/record-other-income.dto';
export declare class IncomeController {
    private readonly income;
    constructor(income: IncomeService);
    listCategories(farmId: string): Promise<{
        name: string;
        farmId: string | null;
        id: string;
        createdAt: Date;
        isSystem: boolean;
    }[]>;
    createCategory(farmId: string, dto: CreateIncomeCategoryDto): Promise<{
        name: string;
        farmId: string | null;
        id: string;
        createdAt: Date;
        isSystem: boolean;
    }>;
    record(farmId: string, userId: string, dto: RecordOtherIncomeDto): Promise<{
        date: Date;
        farmId: string;
        id: string;
        createdAt: Date;
        description: string | null;
        amount: import("@prisma/client/runtime/client").Decimal;
        createdById: string;
        financialAccountId: string;
        categoryId: string;
    }>;
    findAll(farmId: string): Promise<{
        date: Date;
        farmId: string;
        id: string;
        createdAt: Date;
        description: string | null;
        amount: import("@prisma/client/runtime/client").Decimal;
        createdById: string;
        financialAccountId: string;
        categoryId: string;
    }[]>;
    findOne(farmId: string, id: string): Promise<{
        date: Date;
        farmId: string;
        id: string;
        createdAt: Date;
        description: string | null;
        amount: import("@prisma/client/runtime/client").Decimal;
        createdById: string;
        financialAccountId: string;
        categoryId: string;
    }>;
}
