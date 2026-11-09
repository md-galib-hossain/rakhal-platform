import { CursorPaginationQueryDto } from 'src/common/pagination';
import type { DispatchStatus } from '../../domain/dispatch-status';
export declare class DispatchQueryDto extends CursorPaginationQueryDto {
    buyerId?: string;
    from?: string;
    to?: string;
    status?: DispatchStatus;
}
export declare class StatementQueryDto {
    month: string;
}
