import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListPayablesQueryDto extends CursorPaginationQueryDto {
    supplierId?: string;
    dueBefore?: string;
    dueAfter?: string;
}
