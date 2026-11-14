import { Prisma } from '@prisma/client';
import { clampNonNegative, round2 } from './money';

/**
 * Discount a coupon applies to a subtotal (RAKHAL-222, PRD §33.1). Never
 * exceeds the subtotal (CPN-05 — a coupon alone can zero a total but not go
 * negative). `FREE_DAYS` is priced as a full-subtotal discount for MVP.
 */
export function computeCouponDiscount(
  coupon: { type: 'PERCENT' | 'FIXED' | 'FREE_DAYS'; value: Prisma.Decimal },
  subtotal: Prisma.Decimal,
): Prisma.Decimal {
  let raw: Prisma.Decimal;
  switch (coupon.type) {
    case 'PERCENT':
      raw = subtotal.times(coupon.value).dividedBy(100);
      break;
    case 'FIXED':
      raw = coupon.value;
      break;
    case 'FREE_DAYS':
      raw = subtotal;
      break;
  }
  const discount = clampNonNegative(round2(raw));
  return discount.gt(subtotal) ? subtotal : discount;
}
