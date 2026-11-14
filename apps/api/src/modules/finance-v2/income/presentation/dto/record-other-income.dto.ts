import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * `POST /finance/income` (RAKHAL-350, `FINANCE_V2_DESIGN.md` §1.3, §5.1).
 * Tenant (`farmId`) comes from the access token via `FarmContextGuard` —
 * never accepted in the body. Money must land somewhere immediately — this
 * is direct income, not a receivable — so `financialAccountId` is required,
 * same as `CreatePaymentDto`'s own `financialAccountId`.
 */
export class RecordOtherIncomeDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  date!: string;

  /** Optional: a farm has one account and the server uses it when this is omitted. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;
}
