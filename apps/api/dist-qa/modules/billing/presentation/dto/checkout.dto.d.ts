import { BillingPeriod } from '@prisma/client';
export declare class CheckoutDto {
    planId: string;
    billingPeriod: BillingPeriod;
    couponCode?: string;
}
