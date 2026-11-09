import { BillingPeriod } from '@prisma/client';
export declare class PreviewCheckoutDto {
    planId: string;
    billingPeriod: BillingPeriod;
    couponCode: string;
}
