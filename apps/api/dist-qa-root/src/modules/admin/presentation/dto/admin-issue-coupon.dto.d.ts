import { CouponType } from '@prisma/client';
export declare class AdminIssueCouponDto {
    code: string;
    type: CouponType;
    value: number;
    maxRedemptions: number;
    perFarmLimit?: number;
    validFrom: string;
    validUntil: string;
    applicablePlanIds?: string[];
    minSpend?: number;
}
