import { IsDateString } from 'class-validator';

/** RAKHAL-371 — `from`/`to` are both required; `GET /finance/summary` has no
 * meaningful default period, unlike a list endpoint's optional date filter. */
export class FinanceSummaryQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
