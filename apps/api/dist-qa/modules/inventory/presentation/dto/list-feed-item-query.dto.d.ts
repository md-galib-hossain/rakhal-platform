import { FeedClass } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListFeedItemQueryDto extends CursorPaginationQueryDto {
    search?: string;
    feedClass?: FeedClass;
    includeArchived: boolean;
}
