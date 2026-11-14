import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';
import { PayableStatus } from '../../domain/payable-status';

/**
 * `GET /purchasing/purchases` v2 (RAKHAL-375, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §5.13). Cursor-paginated per house convention, with
 * the same SQL-expressible `paymentStatus` technique RAKHAL-368's
 * `ListSalesQueryDto` established — `PurchaseService`'s own
 * `buildPaymentStatusWhere` compiles this against the `payable` relation,
 * never page post-filtering.
 */
export class ListPurchasesQueryDto extends CursorPaginationQueryDto {
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
}
