import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type SalesSummaryGranularity = 'day' | 'week' | 'month';

/** `GET /sales/summary?from&to&granularity` (RAKHAL-374). `granularity`
 * defaults to `day` — matches a short window on the Sales Overview screen. */
export class SalesSummaryQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: SalesSummaryGranularity = 'day';
}
