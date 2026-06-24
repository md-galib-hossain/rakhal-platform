import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { FinancePaymentMethod } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `POST /finance/transactions/:id/void` — owner-only reversal (PRD §16.2). */
export class VoidTransactionDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  reasonCategory!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  reasonNotes?: string;
}

/** `POST /finance/{receivables,payables}/:id/record-payment`. */
export class RecordPaymentDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(FinancePaymentMethod)
  paymentMethod?: FinancePaymentMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}

/** `POST /finance/wallet/add-funds`. */
export class AddFundsDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsEnum(FinancePaymentMethod)
  paymentMethod?: FinancePaymentMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

/** `POST /finance/wallet/withdraw`. */
export class WithdrawDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  fundName!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsEnum(FinancePaymentMethod)
  paymentMethod?: FinancePaymentMethod;

  @IsOptional()
  @IsDateString()
  date?: string;
}
