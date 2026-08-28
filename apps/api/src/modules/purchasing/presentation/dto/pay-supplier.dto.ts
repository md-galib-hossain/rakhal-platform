import { PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

/**
 * `POST /purchasing/payables/:id/payments` (RAKHAL-376, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §16.8). HTTP-layer validation for
 * `PaySupplierUseCase.execute`'s existing `PaySupplierInput` shape
 * (RAKHAL-349) — `payableId` itself comes from the route param, not the
 * body. No use-case logic change.
 */
export class PaySupplierDto {
  @IsString()
  financialAccountId!: string;

  @IsPositive()
  amount!: number;

  @IsIn(Object.values(PaymentMethod))
  method!: PaymentMethod;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
