import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';

/**
 * `GET /purchasing/payables` (RAKHAL-348). Cursor-paginated per house
 * convention (`CursorPaginationQueryDto`). Mirrors
 * `ListReceivablesQueryDto` (`finance-v2/receivables/presentation/dto/
 * list-receivables-query.dto.ts`, RAKHAL-340) exactly — `status` is
 * deliberately not a filter here either, for the identical reason: it's
 * derived per-row from `PaymentAllocation` sums, not a column a `WHERE`
 * clause can match against without breaking cursor semantics.
 */
export class ListPayablesQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  supplierId?: string;

  /** Only payables due on/before this date (ISO 8601). */
  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  /** Only payables due on/after this date (ISO 8601). */
  @IsOptional()
  @IsDateString()
  dueAfter?: string;
}
