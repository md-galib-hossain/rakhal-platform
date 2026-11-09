import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CreditSpendSurface } from '../../domain/credit-policy';
type Db = PrismaService | Prisma.TransactionClient;
export declare class CreditWalletService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getBalance(farmId: string, db?: Db): Promise<Prisma.Decimal>;
    credit(farmId: string, amount: Prisma.Decimal, db?: Db): Promise<void>;
    debit(farmId: string, amount: Prisma.Decimal, opts?: {
        allowNegative?: boolean;
        db?: Db;
    }): Promise<void>;
    applyToCharge(tx: Prisma.TransactionClient, farmId: string, remaining: Prisma.Decimal, surface?: CreditSpendSurface): Promise<Prisma.Decimal>;
    assertCashOutEnabled(): void;
}
export {};
