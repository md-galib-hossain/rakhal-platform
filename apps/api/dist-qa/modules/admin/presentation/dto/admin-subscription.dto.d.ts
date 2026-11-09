import { BillingPeriod } from '@prisma/client';
export declare class CommercialReasonDto {
    reason: string;
}
export declare class SubscriptionActionDto extends CommercialReasonDto {
    confirm: string;
}
export declare class ActivateSubscriptionDto extends SubscriptionActionDto {
    planId: string;
    period: BillingPeriod;
}
export declare class CompSubscriptionDto extends SubscriptionActionDto {
    planId: string;
    days: number;
}
export declare class ExtendSubscriptionDto extends SubscriptionActionDto {
    days: number;
}
export declare class UpdatePlanDto extends CommercialReasonDto {
    description?: string;
    monthlyPrice?: number;
    yearlyPrice?: number;
    maxCattle?: number;
    maxFarmMembers?: number;
}
export declare class SetPlanFeatureDto extends CommercialReasonDto {
    enabled: boolean;
}
