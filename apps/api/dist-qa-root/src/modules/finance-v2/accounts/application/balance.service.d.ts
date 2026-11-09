import { FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { Money } from 'src/common/money';
export interface AccountBalance {
    id: string;
    name: string;
    type: FinancialAccountType;
    balance: Money;
}
export interface FarmBalances {
    accounts: AccountBalance[];
    byType: Record<FinancialAccountType, Money>;
}
export interface RakhalBalanceResult {
    rakhalBalance: Money;
    breakdown: {
        cash: Money;
        bank: Money;
        mfs: Money;
    };
    accounts: AccountBalance[];
}
export declare class BalanceService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    getAccountBalance(farmId: string, financialAccountId: string): Promise<AccountBalance>;
    getFarmBalances(farmId: string, includeArchived?: boolean): Promise<FarmBalances>;
    getRakhalBalance(farmId: string): Promise<RakhalBalanceResult>;
    private sumLedgerAccount;
}
