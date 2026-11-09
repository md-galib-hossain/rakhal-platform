import { FeedGridSourceType } from '@prisma/client';
export declare class FeedEntryLineDto {
    planLineId?: string;
    sourceType: FeedGridSourceType;
    feedItemId?: string;
    feedStockId?: string;
    offeredKg: number;
    refusalKg?: number;
}
export declare class FeedDraftEntryDto {
    cattleId: string;
    offeredKg: number;
    lines?: FeedEntryLineDto[];
    refusalKg?: number;
    sourceType?: FeedGridSourceType;
    feedItemId?: string;
    feedStockId?: string;
}
export declare class SaveFeedDraftDto {
    date: string;
    sourceType?: FeedGridSourceType;
    feedItemId?: string;
    feedStockId?: string;
    entries: FeedDraftEntryDto[];
}
