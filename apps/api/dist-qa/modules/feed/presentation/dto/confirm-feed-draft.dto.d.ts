import { FeedGridSourceType } from '@prisma/client';
import { FeedDraftEntryDto } from './save-feed-draft.dto';
export declare class ConfirmFeedDraftDto {
    date: string;
    sourceType?: FeedGridSourceType;
    feedItemId?: string;
    feedStockId?: string;
    entries?: FeedDraftEntryDto[];
}
