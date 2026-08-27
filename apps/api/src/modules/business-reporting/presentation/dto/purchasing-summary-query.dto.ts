import { IsDateString } from 'class-validator';

/** `GET /purchasing/summary?from&to` (RAKHAL-375) — mirrors
 * `FinanceSummaryQueryDto` (RAKHAL-371): both `from`/`to` required. */
export class PurchasingSummaryQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
