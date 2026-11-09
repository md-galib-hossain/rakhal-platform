import { ExpenseCategory } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export type CattleExpenseBucket = 'feed' | 'health' | 'breeding' | 'others';
export interface CattleFinanceTotals {
    totalIncome: number;
    totalCost: number;
    expense: Record<CattleExpenseBucket, number>;
    income: {
        milk_sales: number;
        calf_sales: number;
    };
}
export declare function resolveEffectiveMilkRate(prisma: PrismaService, farmId: string, onOrBefore: Date): Promise<number>;
export declare function sumSaleableMilkLitres(prisma: PrismaService, cattleId: string, start: Date, end: Date): Promise<number>;
export declare function computeCattleFinance(prisma: PrismaService, farmId: string, cattleId: string, start: Date, end: Date): Promise<CattleFinanceTotals>;
export declare function cattleExpenseBucket(category: ExpenseCategory): CattleExpenseBucket;
