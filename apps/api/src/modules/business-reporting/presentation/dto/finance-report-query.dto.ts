import { IsDateString, IsOptional } from 'class-validator';

/** `GET /finance/reports/profit-loss` / `.../cash-flow` (RAKHAL-379) — both
 * required, same "no meaningful default period" reasoning
 * `FinanceSummaryQueryDto` (RAKHAL-371) already documents. */
export class FinanceReportPeriodQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

/** `GET /finance/reports/trial-balance` (RAKHAL-379) — `asOf` optional,
 * defaults to "now", same point-in-time convention `AgingQueryDto` uses. */
export class TrialBalanceQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
