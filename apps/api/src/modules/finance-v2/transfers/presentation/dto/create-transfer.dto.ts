import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * `POST /finance/transfers` (RAKHAL-338, `FINANCE_V2_DESIGN.md` §4.4).
 * Tenant (`farmId`) comes from the access token via `FarmContextGuard` —
 * never accepted in the body. See `TransferService.createTransfer`'s doc
 * comment for the exact double-entry lines this produces.
 */
export class CreateTransferDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  fromFinancialAccountId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  toFinancialAccountId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  /** Optional transfer fee (e.g. an MFS cash-out charge). Defaults to ৳0 when omitted. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
