import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Shared list query for the health sub-resources. Cursor-paginated
 * (`CursorPaginationQueryDto`). The active farm comes from the token context
 * (`FarmContextGuard`), never the query string — only an optional `cattleId`
 * (verified to belong to the farm), `search`, and a created-date range narrow
 * the result.
 */
export class HealthListQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
