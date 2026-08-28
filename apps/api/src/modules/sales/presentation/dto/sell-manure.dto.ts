import { PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

/**
 * `POST /sales/manure` (RAKHAL-376, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §16.8). HTTP-layer validation for `RecordManureSaleUseCase.execute`'s
 * existing `RecordManureSaleInput` shape (RAKHAL-347, RD-058) — `quantity`/
 * `unitId` stay optional per that use case's own doc comment (no manure
 * production/stock model exists). No use-case logic change.
 */
export class SellManureDto {
  @IsOptional()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsPositive()
  totalAmount!: number;

  @IsOptional()
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountReceived?: number;

  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  paymentMethod?: PaymentMethod;

  @IsDateString()
  saleDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
