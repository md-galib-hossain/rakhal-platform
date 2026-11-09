import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListTransactionsQueryDto extends CursorPaginationQueryDto {
    type?: string;
    from?: string;
    to?: string;
    financialAccountId?: string;
    status?: 'POSTED' | 'REVERSED';
}
