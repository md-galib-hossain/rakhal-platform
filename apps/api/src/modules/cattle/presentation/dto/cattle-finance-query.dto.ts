import { IsOptional, IsString, Matches } from 'class-validator';

export class CattleFinanceQueryDto {
  /** YYYY-MM filter (e.g. "2026-01"). Defaults to the current month. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'period must be YYYY-MM' })
  period?: string;
}
