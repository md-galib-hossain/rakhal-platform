import { Coupon, CouponStatus, CouponType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export interface IssueCouponInput {
    code: string;
    type: CouponType;
    value: number;
    maxRedemptions: number;
    perFarmLimit?: number;
    validFrom: Date;
    validUntil: Date;
    applicablePlanIds?: string[];
    minSpend?: number;
}
export interface CouponReservation {
    couponId: string;
    discount: Prisma.Decimal;
}
export declare class CouponService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    issue(input: IssueCouponInput): Promise<Coupon>;
    list(status?: CouponStatus): Promise<Coupon[]>;
    disable(id: string): Promise<Coupon>;
    private validateAndPrice;
    preview(params: {
        code: string;
        farmId: string;
        planId: string;
        subtotal: Prisma.Decimal;
        phoneVerifiedAt: Date | null;
    }): Promise<CouponReservation>;
    reserve(tx: Prisma.TransactionClient, params: {
        code: string;
        farmId: string;
        planId: string;
        subtotal: Prisma.Decimal;
        phoneVerifiedAt: Date | null;
    }): Promise<CouponReservation>;
    recordRedemption(tx: Prisma.TransactionClient, params: {
        couponId: string;
        farmId: string;
        invoiceId: string;
        discount: Prisma.Decimal;
    }): Promise<void>;
}
