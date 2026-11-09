import { Prisma } from '@prisma/client';
export declare function computeCouponDiscount(coupon: {
    type: 'PERCENT' | 'FIXED' | 'FREE_DAYS';
    value: Prisma.Decimal;
}, subtotal: Prisma.Decimal): Prisma.Decimal;
