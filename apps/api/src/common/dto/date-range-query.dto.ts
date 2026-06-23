import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Reusable `from`/`to` date-range filter for list and report endpoints.
 *
 * Both bounds are optional ISO-8601 date strings (e.g. `2026-01-01` or a full
 * timestamp). Mix into a query DTO alongside {@link CursorPaginationQueryDto}.
 *
 * @example
 * class ListMilkLogQueryDto extends CursorPaginationQueryDto {
 *   @IsOptional() @IsISO8601() from?: string;
 *   @IsOptional() @IsISO8601() to?: string;
 * }
 * // or just: class X extends DateRangeQueryDto {}
 *
 * Convert to Date in the service: `from ? new Date(from) : undefined`.
 */
export class DateRangeQueryDto {
  /** Inclusive lower bound (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
