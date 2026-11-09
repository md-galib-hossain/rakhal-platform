import { FeedItemStockMovementReason } from '@prisma/client';
export declare class AdjustFeedItemStockDto {
    adjustment: number;
    reason: FeedItemStockMovementReason;
    notes?: string;
    saleLineId?: string;
    batchId?: string;
}
