import { Prisma } from '@prisma/client';
import { computeCouponDiscount } from './coupon-pricing';

const D = (n: string) => new Prisma.Decimal(n);

describe('coupon pricing', () => {
  it('PERCENT discounts a proportion of the subtotal', () => {
    expect(
      computeCouponDiscount(
        { type: 'PERCENT', value: D('10') },
        D('1000'),
      ).toString(),
    ).toBe('100');
  });

  it('PERCENT 100 zeroes the subtotal (GALIB100)', () => {
    expect(
      computeCouponDiscount(
        { type: 'PERCENT', value: D('100') },
        D('2500'),
      ).toString(),
    ).toBe('2500');
  });

  it('FIXED discounts a flat amount, capped at the subtotal (CPN-05)', () => {
    expect(
      computeCouponDiscount(
        { type: 'FIXED', value: D('300') },
        D('1000'),
      ).toString(),
    ).toBe('300');
    expect(
      computeCouponDiscount(
        { type: 'FIXED', value: D('5000') },
        D('1000'),
      ).toString(),
    ).toBe('1000');
  });

  it('FREE_DAYS discounts the full subtotal', () => {
    expect(
      computeCouponDiscount(
        { type: 'FREE_DAYS', value: D('7') },
        D('1000'),
      ).toString(),
    ).toBe('1000');
  });

  it('never returns a negative discount', () => {
    expect(
      computeCouponDiscount(
        { type: 'PERCENT', value: D('150') },
        D('1000'),
      ).toString(),
    ).toBe('1000');
  });
});
