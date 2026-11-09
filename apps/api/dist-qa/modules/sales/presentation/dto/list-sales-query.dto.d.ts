import { SaleLineType, SaleStatus } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { ReceivableStatus } from 'src/modules/finance-v2/receivables/domain/receivable-status';
export declare class ListSalesQueryDto extends CursorPaginationQueryDto {
    from?: string;
    to?: string;
    status?: SaleStatus;
    paymentStatus?: ReceivableStatus;
    customerId?: string;
    lineType?: SaleLineType;
    q?: string;
    includeDrafts: boolean;
}
