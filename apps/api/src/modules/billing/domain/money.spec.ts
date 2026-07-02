import { Prisma } from '@prisma/client';
import { clampNonNegative, computeInvoiceTotal, round2 } from './money';

const D = (n: string) => new Prisma.Decimal(n);

describe('billing money', () => {
  it('rounds half-up to 2 dp', () => {
    expect(round2(D('100.125')).toString()).toBe('100.13');
    expect(round2(D('100.124')).toString()).toBe('100.12');
    expect(round2(D('2500')).toString()).toBe('2500');
  });

  it('computes total = subtotal − discount', () => {
    expect(computeInvoiceTotal(D('2500'), D('0')).toString()).toBe('2500');
    expect(computeInvoiceTotal(D('1000'), D('250')).toString()).toBe('750');
  });

  it('never returns a negative total', () => {
    expect(computeInvoiceTotal(D('100'), D('250')).toString()).toBe('0');
    expect(clampNonNegative(D('-0.01')).toString()).toBe('0');
  });

  it('a full (100%) discount yields exactly 0', () => {
    expect(computeInvoiceTotal(D('2500'), D('2500')).isZero()).toBe(true);
  });
});
