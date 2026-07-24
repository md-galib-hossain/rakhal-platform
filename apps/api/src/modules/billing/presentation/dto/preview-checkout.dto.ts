import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BillingPeriod } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * `POST /billing/checkout/preview` — non-mutating price preview shown in the
 * upgrade modal's coupon stage before the real `POST /billing/checkout`.
 * `couponCode` is required here (unlike `CheckoutDto`) — previewing without
 * one is pointless since the client already knows the plan price from
 * `GET /plans`.
 */
export class PreviewCheckoutDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  couponCode!: string;
}
