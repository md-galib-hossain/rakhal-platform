import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListShedQueryDto extends CursorPaginationQueryDto {
    search?: string;
    includeArchived: boolean;
}
