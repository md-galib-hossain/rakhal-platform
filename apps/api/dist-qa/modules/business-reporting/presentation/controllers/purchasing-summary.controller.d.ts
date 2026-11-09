import { PurchasingSummaryService } from '../../application/purchasing-summary.service';
import { PurchasingSummaryQueryDto } from '../dto/purchasing-summary-query.dto';
export declare class PurchasingSummaryController {
    private readonly purchasingSummary;
    constructor(purchasingSummary: PurchasingSummaryService);
    getSummary(farmId: string, query: PurchasingSummaryQueryDto): Promise<import("../../application/purchasing-summary.service").PurchasingSummary>;
}
