import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListBuyerQueryDto extends CursorPaginationQueryDto {
    search?: string;
    includeArchived: boolean;
}
