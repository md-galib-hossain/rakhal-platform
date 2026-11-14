import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';

/**
 * `GET /finance/receivables` (RAKHAL-340). Cursor-paginated per house
 * convention (`CursorPaginationQueryDto`). `status` is deliberately not a
 * filter here — it's derived per-row from `PaymentAllocation` sums, not a
 * column a `WHERE` clause can match against without breaking cursor
 * semantics; see `ReceivableService.listReceivables`'s own doc comment.
 */
export class ListReceivablesQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  customerId?: string;

  /** Only receivables due on/before this date (ISO 8601). */
  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  /** Only receivables due on/after this date (ISO 8601). */
  @IsOptional()
  @IsDateString()
  dueAfter?: string;
}
