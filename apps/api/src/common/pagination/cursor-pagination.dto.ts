import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Reusable query DTO for cursor-based (keyset) pagination.
 *
 * Extend it in a feature module's list query DTO and add your own filters:
 *
 * @example
 * export class ListCattleQueryDto extends CursorPaginationQueryDto {
 *   @IsOptional() @IsString() search?: string;
 * }
 *
 * // Controller
 * @Get()
 * list(@Query() query: ListCattleQueryDto, @CurrentFarmId() farmId: string) {
 *   return this.cattleService.list(farmId, query);
 * }
 *
 * Wire fields:
 *  - `limit`     page size, 1..100 (default 20)
 *  - `cursor`    opaque token from the previous page's `meta.endCursor`
 *  - `sortOrder` 'asc' | 'desc' (default 'desc' — newest first)
 */
export class CursorPaginationQueryDto {
  /** Max items to return (1..100, default 20). */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  /** Opaque cursor from the previous response's `meta.endCursor`. Omit for page 1. */
  @IsOptional()
  @IsString()
  cursor?: string;

  /** Sort direction applied to the keyset (default 'desc'). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
