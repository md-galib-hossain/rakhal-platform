import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { PaymentDirection, PaymentMethod } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * `POST /finance/payments` (RAKHAL-337, `FINANCE_V2_DESIGN.md` §4.5, §4.6).
 * Tenant (`farmId`) comes from the access token via `FarmContextGuard` —
 * never accepted in the body. One payment always hits exactly one
 * `FinancialAccount` — see `create-payment.dto.ts`'s sibling
 * `PaymentService.recordPayment` doc comment for the journal-posting rule.
 */
export class CreatePaymentDto {
  @IsEnum(PaymentDirection)
  direction!: PaymentDirection;

  /** Optional: a farm has one account and the server uses it when this is omitted. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
