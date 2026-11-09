import { SalesSummaryService } from '../../application/sales-summary.service';
import { SalesSummaryQueryDto } from '../dto/sales-summary-query.dto';
export declare class SalesSummaryController {
    private readonly salesSummary;
    constructor(salesSummary: SalesSummaryService);
    getSummary(farmId: string, query: SalesSummaryQueryDto): Promise<import("../../application/sales-summary.service").SalesSummary>;
}
