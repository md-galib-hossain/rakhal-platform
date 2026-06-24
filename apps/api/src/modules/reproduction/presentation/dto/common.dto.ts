import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

/**
 * Shared list query for the reproduction sub-resources. Cursor-paginated
 * (`CursorPaginationQueryDto`). The active farm comes from the token context
 * (`FarmContextGuard`), never the query string — only an optional `cattleId`
 * (verified to belong to the farm) and a created-date range narrow the result.
 */
export class ReproductionListQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class BooleanSymptomsDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  standingHeat?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mucusDischarge?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mountingBehavior?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  restlessness?: boolean;
}
