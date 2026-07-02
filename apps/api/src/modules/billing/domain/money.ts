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
