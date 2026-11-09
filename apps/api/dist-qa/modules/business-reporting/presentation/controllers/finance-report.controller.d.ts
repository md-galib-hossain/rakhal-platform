import { ProfitLossReportService } from '../../application/reports/profit-loss-report.service';
import { CashFlowReportService } from '../../application/reports/cash-flow-report.service';
import { TrialBalanceReportService } from '../../application/reports/trial-balance-report.service';
import { FinanceReportPeriodQueryDto, TrialBalanceQueryDto } from '../dto/finance-report-query.dto';
export declare class FinanceReportController {
    private readonly profitLoss;
    private readonly cashFlow;
    private readonly trialBalance;
    constructor(profitLoss: ProfitLossReportService, cashFlow: CashFlowReportService, trialBalance: TrialBalanceReportService);
    getProfitLoss(farmId: string, query: FinanceReportPeriodQueryDto): Promise<import("../../application/reports/profit-loss-report.service").ProfitLossReport>;
    getCashFlow(farmId: string, query: FinanceReportPeriodQueryDto): Promise<import("../../application/reports/cash-flow-report.service").CashFlowReport>;
    getTrialBalance(farmId: string, query: TrialBalanceQueryDto): Promise<import("../../application/reports/trial-balance-report.service").TrialBalanceReport>;
}
