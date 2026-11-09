import { CursorPaginationQueryDto } from 'src/common/pagination';
import { PayableStatus } from '../../domain/payable-status';
export declare class ListPurchasesQueryDto extends CursorPaginationQueryDto {
    from?: string;
    to?: string;
    supplierId?: string;
    paymentStatus?: PayableStatus;
}
