import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MilkSession } from '@prisma/client';
import { trimString } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** Trend window for `GET /milk/overview`'s `trend` series (dashboard + Milk page
 * "Production Trend Over Time" range picker). `lifetime` omits the lower date bound. */
export const MILK_TREND_RANGES = [
  '7d',
  '30d',
  '3m',
  '6m',
  '1y',
  'lifetime',
] as const;
export type MilkTrendRange = (typeof MILK_TREND_RANGES)[number];

/** Query for `GET /milk/overview`. */
export class MilkOverviewQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(MILK_TREND_RANGES)
  range?: MilkTrendRange;
}

/** Query for `GET /milk/log`. */
export class MilkLogQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;

  @IsOptional()
  @IsEnum(MilkSession)
  session?: MilkSession;
}

/** Query for `GET /milk/anomalies`. Cursor-paginated (RD-058 — unbounded `findMany`,
 * a farm with 200+ flagged rows loaded them all in one response). */
export class MilkAnomalyQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

/** Query for `GET /milk/availability` (RAKHAL-343). Omit `tankId` for every
 * active SELLABLE tank; pass it to scope to one. */
export class MilkAvailabilityQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  tankId?: string;
}
