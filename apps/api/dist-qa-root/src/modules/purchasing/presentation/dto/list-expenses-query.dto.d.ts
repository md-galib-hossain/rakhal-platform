import { ExpenseCategory } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { PayableStatus } from '../../domain/payable-status';
export declare class ListExpensesQueryDto extends CursorPaginationQueryDto {
    from?: string;
    to?: string;
    supplierId?: string;
    paymentStatus?: PayableStatus;
    category?: ExpenseCategory;
}
