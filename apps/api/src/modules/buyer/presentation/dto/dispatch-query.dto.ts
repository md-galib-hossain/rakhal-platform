import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';

/** Query for `GET /milk/dispatch` — cursor-paginated history. */
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
}

/** Query for `GET /buyers/:id/statement` — `?month=YYYY-MM`. */
export class StatementQueryDto {
  @Transform(trimString)
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month!: string;
}
