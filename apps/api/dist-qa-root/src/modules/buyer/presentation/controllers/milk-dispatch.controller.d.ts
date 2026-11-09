import { BuyerService } from '../../application/services/buyer.service';
import { RecordDispatchDto } from '../dto/record-dispatch.dto';
import { DispatchQueryDto } from '../dto/dispatch-query.dto';
export declare class MilkDispatchController {
    private readonly buyerService;
    constructor(buyerService: BuyerService);
    record(farmId: string, userId: string, dto: RecordDispatchDto): Promise<{
        id: string;
        dispatchNumber: string;
        buyerName: string;
        driverName: string | null;
        volumeDispatchedL: number;
        volumeReceivedL: number | null;
        discrepancyL: number | null;
        discrepancyFlagged: boolean;
        calculatedAmount: number;
        priceBreakdown: import("../../domain/milk-price").MilkPriceBreakdown;
        paymentDueDate: Date | null;
        amountReceived: number;
        tankUpdated: boolean;
        saleId: string | null;
        status: import("../../domain/dispatch-status").DispatchStatus;
    }>;
    history(farmId: string, query: DispatchQueryDto): Promise<{
        items: {
            status: import("../../domain/dispatch-status").DispatchStatus;
            buyer: {
                name: string;
                id: string;
            };
            farmId: string;
            id: string;
            createdAt: Date;
            cancelledAt: Date | null;
            notes: string | null;
            createdBy: string;
            basePricePerLitre: number;
            paidAmount: number;
            saleId: string | null;
            fatPct: number | null;
            financeTransactionId: string | null;
            buyerId: string;
            dispatchNumber: string;
            driverName: string | null;
            dispatchedAt: Date;
            volumeDispatchedL: number;
            volumeReceivedL: number | null;
            scc: number | null;
            discrepancyL: number | null;
            discrepancyFlagged: boolean;
            fatBonus: number;
            sccPenalty: number;
            calculatedAmount: number;
            paymentDueDate: Date | null;
        }[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
}
