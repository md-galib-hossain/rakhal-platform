import { Prisma } from '@prisma/client';
import {
  clampNonNegative,
  computeGrandTotal,
  computeInvoiceTotal,
  computeTax,
  round2,
} from './money';

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

  it('VAT off (0%) is always 0', () => {
    expect(computeTax(D('2500'), D('0')).isZero()).toBe(true);
  });

  it('computes VAT on the taxable base, rounded half-up', () => {
    expect(computeTax(D('2500'), D('15')).toString()).toBe('375');
    expect(computeTax(D('1000'), D('7.5')).toString()).toBe('75');
    expect(computeTax(D('99.99'), D('15')).toString()).toBe('15'); // 14.9985 → 15.00
  });

  it('grand total with VAT off equals subtotal − discount − credit', () => {
    expect(
      computeGrandTotal(D('2500'), D('500'), D('0'), D('200')).toString(),
    ).toBe('1800');
  });

  it('grand total adds VAT on the post-discount price, then applies credit', () => {
    // (2500 − 500) + 15% VAT (300) − 300 credit = 2000 + 300 − 300 = 2000
    expect(
      computeGrandTotal(D('2500'), D('500'), D('300'), D('300')).toString(),
    ).toBe('2000');
  });

  it('grand total never goes below 0 even when credit exceeds the charge', () => {
    expect(
      computeGrandTotal(D('1000'), D('0'), D('150'), D('5000')).toString(),
    ).toBe('0');
  });
});
