import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { AgingService } from './aging.service';
interface PeriodMetric {
    current: number;
    previous: number;
    changePct: number | null;
}
export interface FinanceSummary {
    period: {
        from: string;
        to: string;
    };
    previousPeriod: {
        from: string;
        to: string;
    };
    revenue: PeriodMetric;
    expenses: PeriodMetric;
    netProfit: PeriodMetric;
    netCashFlow: PeriodMetric;
    position: {
        availableBalance: string;
        totalReceivable: string;
        receivableCount: number;
        totalPayable: string;
        payableCount: number;
        accountCount: number;
    };
}
export declare class PeriodSummaryService {
    private readonly prisma;
    private readonly balance;
    private readonly aging;
    constructor(prisma: PrismaService, balance: BalanceService, aging: AgingService);
    getSummary(farmId: string, from: Date, to: Date): Promise<FinanceSummary>;
    private cashFlowNet;
}
export {};
