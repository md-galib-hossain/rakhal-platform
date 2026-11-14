import { Prisma } from '@prisma/client';

/** Round a money Decimal to 2 dp, half-up (PAY-07). */
export function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Clamp to >= 0 — discounts can never make a total negative (PAY-07). */
export function clampNonNegative(value: Prisma.Decimal): Prisma.Decimal {
  return value.isNegative() ? new Prisma.Decimal(0) : value;
}

/**
 * Invoice total = subtotal − discount, rounded half-up to 2 dp, never below 0.
 * All arithmetic is Decimal (never float) — PRD §32.1/PAY-07.
 */
export function computeInvoiceTotal(
  subtotal: Prisma.Decimal,
  discountTotal: Prisma.Decimal,
): Prisma.Decimal {
  return clampNonNegative(round2(subtotal.minus(discountTotal)));
}

/**
 * VAT amount on a taxable base (RAKHAL-237, TAX-01). `ratePct` is a whole/decimal
 * percentage (e.g. 15 for 15%). Rounded half-up to 2 dp; a 0 rate ⇒ 0 (VAT off at
 * launch keeps the total identical to the pre-237 behaviour).
 */
export function computeTax(
  taxableBase: Prisma.Decimal,
  ratePct: Prisma.Decimal,
): Prisma.Decimal {
  if (ratePct.isZero() || taxableBase.isZero()) return new Prisma.Decimal(0);
  return round2(clampNonNegative(taxableBase).times(ratePct).dividedBy(100));
}

/**
 * Grand total = (subtotal − discount) + VAT − credit, rounded half-up, never
 * below 0 (TAX-01). VAT is charged on the post-discount price; closed-loop
 * Rakhal Credit is applied last (it can absorb the VAT too). With VAT off
 * (`taxAmount = 0`) this reduces exactly to subtotal − discount − credit.
 */
export function computeGrandTotal(
  subtotal: Prisma.Decimal,
  discountTotal: Prisma.Decimal,
  taxAmount: Prisma.Decimal,
  creditApplied: Prisma.Decimal,
): Prisma.Decimal {
  const netAfterDiscount = clampNonNegative(subtotal.minus(discountTotal));
  return clampNonNegative(
    round2(netAfterDiscount.plus(taxAmount).minus(creditApplied)),
  );
}
