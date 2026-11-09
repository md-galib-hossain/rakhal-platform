import { LedgerAccountCategory } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface TrialBalanceLine {
    code: string;
    name: string;
    category: LedgerAccountCategory;
    debit: string;
    credit: string;
}
export interface TrialBalanceReport {
    asOf: string;
    lines: TrialBalanceLine[];
    totalDebit: string;
    totalCredit: string;
    balanced: boolean;
}
export declare class TrialBalanceReportService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getReport(farmId: string, asOf: Date): Promise<TrialBalanceReport>;
}
