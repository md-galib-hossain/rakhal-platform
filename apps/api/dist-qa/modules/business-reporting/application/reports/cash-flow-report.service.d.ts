import { FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface CashFlowAccountLine {
    id: string;
    name: string;
    type: FinancialAccountType;
    openingBalance: string;
    inflow: string;
    outflow: string;
    closingBalance: string;
}
export interface CashFlowReport {
    period: {
        from: string;
        to: string;
    };
    accounts: CashFlowAccountLine[];
    totals: {
        openingBalance: string;
        inflow: string;
        outflow: string;
        closingBalance: string;
    };
}
export declare class CashFlowReportService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getReport(farmId: string, from: Date, to: Date): Promise<CashFlowReport>;
    private balanceBefore;
    private movement;
}
