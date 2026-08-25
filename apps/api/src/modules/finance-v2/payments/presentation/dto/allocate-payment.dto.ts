import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

/** One allocation line — settles part of a payment against one outstanding
 * document. Exactly one of `receivableId`/`payableId` must be set; enforced
 * in `PaymentService.allocatePayment` (application layer, not here — the
 * two fields are independently optional at the DTO level since neither
 * `Receivable` (RAKHAL-340) nor `Payable` (RAKHAL-348) exists yet to
 * cross-check against). */
export class AllocatePaymentLineDto {
  @IsOptional()
  @IsString()
  receivableId?: string;

  @IsOptional()
  @IsString()
  payableId?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

/**
 * `POST /finance/payments/:id/allocations` (RAKHAL-337). Creates one or more
 * `PaymentAllocation` rows against an existing `FinancePayment`. Rejected if
 * `SUM(existing allocations) + SUM(this call's allocations)` would exceed
 * the payment's own `amount` — a payment can never be over-allocated.
 */
export class AllocatePaymentDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocatePaymentLineDto)
  allocations!: AllocatePaymentLineDto[];
}
