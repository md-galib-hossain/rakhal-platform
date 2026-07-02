import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { BillingPeriod } from '@prisma/client';

/**
 * Checkout request (RAKHAL-220). The client picks a plan + period only — it
 * **never** sends an amount; the server computes the total (PAY-01).
 */
export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;
}
