import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ExpenseCategory } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';
import { PayableStatus } from '../../domain/payable-status';

/**
 * `GET /purchasing/expenses` v2 (RAKHAL-375, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §5.13). Same shape as `ListPurchasesQueryDto` plus
 * `category` (`Expense` has no line-level equivalent to filter on instead).
 */
export class ListExpensesQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsEnum(PayableStatus)
  paymentStatus?: PayableStatus;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;
}
