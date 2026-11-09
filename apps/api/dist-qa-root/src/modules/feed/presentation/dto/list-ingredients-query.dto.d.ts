import { FeedClass } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListIngredientsQueryDto extends CursorPaginationQueryDto {
    search?: string;
    feedClass?: FeedClass[];
    priceMin?: number;
    priceMax?: number;
    includeArchived: boolean;
}
