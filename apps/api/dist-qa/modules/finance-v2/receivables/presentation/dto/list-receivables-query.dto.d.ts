import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListReceivablesQueryDto extends CursorPaginationQueryDto {
    customerId?: string;
    dueBefore?: string;
    dueAfter?: string;
}
