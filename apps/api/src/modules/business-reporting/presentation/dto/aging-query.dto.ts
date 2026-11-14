import { IsDateString, IsOptional } from 'class-validator';

/**
 * `GET /finance/receivables/aging` / `GET /purchasing/payables/aging`
 * (RAKHAL-369). `asOf` defaults to "now" when omitted — a point-in-time
 * query, never `from`/`to` (`BUSINESS_IA_PRD.md` §4.4's Row A vs Row B
 * split: aging is a position, not a period).
 */
export class AgingQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
