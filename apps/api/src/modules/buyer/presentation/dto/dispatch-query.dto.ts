import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';
import type { DispatchStatus } from '../../domain/dispatch-status';

const DISPATCH_STATUSES: DispatchStatus[] = [
  'PENDING',
  'DELIVERED',
  'CANCELLED',
];

/** Query for `GET /milk/dispatch` / `GET /buyers/dispatches` (RAKHAL-378) —
 * cursor-paginated history. `status` filters against the *derived* status
 * (RAKHAL-366's `deriveDispatchStatus`) via a translated `where` predicate —
 * not a stored column. */
export class DispatchQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  buyerId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn(DISPATCH_STATUSES)
  status?: DispatchStatus;
}

/** Query for `GET /buyers/:id/statement` — `?month=YYYY-MM`. */
export class StatementQueryDto {
  @Transform(trimString)
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month!: string;
}
