import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BillingPeriod } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Checkout request (RAKHAL-220 + coupon seam RAKHAL-222). The client picks a
 * plan + period only — it **never** sends an amount; the server computes the
 * total (PAY-01). `couponCode` is optional and validated/priced server-side.
 */
export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  couponCode?: string;
}
