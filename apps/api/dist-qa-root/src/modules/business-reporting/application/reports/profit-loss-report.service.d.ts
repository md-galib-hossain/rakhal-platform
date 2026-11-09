import { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface ProfitLossLine {
    code: string;
    name: string;
    amount: string;
}
export interface ProfitLossReport {
    period: {
        from: string;
        to: string;
    };
    revenue: {
        lines: ProfitLossLine[];
        total: string;
    };
    expenses: {
        lines: ProfitLossLine[];
        total: string;
    };
    netProfit: string;
}
export declare class ProfitLossReportService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getReport(farmId: string, from: Date, to: Date): Promise<ProfitLossReport>;
    private categoryLines;
}
