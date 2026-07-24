import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { BillingPeriod } from '@prisma/client';

/**
 * Schedule a downgrade/lateral plan change (RFE-036 follow-up). Unlike `CheckoutDto` this never
 * charges — the switch is deferred to the current period's end (PAY-08: no forfeited paid time).
 * `BillingService.scheduleDowngrade` rejects an equal-or-higher-priced target; that must go through
 * the real `checkout()` flow instead.
 */
export class ScheduleDowngradeDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;
}
