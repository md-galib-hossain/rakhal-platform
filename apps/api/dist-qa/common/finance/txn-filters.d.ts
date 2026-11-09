import { LedgerAccountCategory, Prisma } from '@prisma/client';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
type PrismaLike = PrismaService | Prisma.TransactionClient;
export interface LedgerDateRange {
    gte?: Date;
    lt?: Date;
}
export declare function ledgerCategoryNet(prisma: PrismaLike, farmId: string, category: LedgerAccountCategory, range?: LedgerDateRange): Promise<number>;
export declare function ledgerAccountNet(prisma: PrismaLike, farmId: string, code: string, category: LedgerAccountCategory, range?: LedgerDateRange): Promise<number>;
export declare function deriveOutstanding(totalAmount: Prisma.Decimal.Value, allocated: Prisma.Decimal.Value): number;
export {};
