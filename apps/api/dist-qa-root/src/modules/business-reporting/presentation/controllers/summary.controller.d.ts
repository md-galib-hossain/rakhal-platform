import { PeriodSummaryService } from '../../application/period-summary.service';
import { FinanceSummaryQueryDto } from '../dto/finance-summary-query.dto';
export declare class SummaryController {
    private readonly periodSummary;
    constructor(periodSummary: PeriodSummaryService);
    getSummary(farmId: string, query: FinanceSummaryQueryDto): Promise<import("../../application/period-summary.service").FinanceSummary>;
}
