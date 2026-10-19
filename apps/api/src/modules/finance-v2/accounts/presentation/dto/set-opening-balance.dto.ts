import { IsNumber, Min } from 'class-validator';

/** `PATCH /finance/accounts/:id/opening-balance` — the corrected opening balance (0 clears it). */
export class SetOpeningBalanceDto {
  @IsNumber()
  @Min(0)
  openingBalance!: number;
}
