import { Prisma } from '@prisma/client';

/**
 * Shared money primitives (RAKHAL-331, Finance V2 — see `FINANCE_V2_DESIGN.md` §1.4/§6).
 *
 * Money is always `Prisma.Decimal` (decimal.js under the hood), never a JS `number`/
 * `Float`. Floats cannot represent `0.1 + 0.2` exactly, which is exactly the class of
 * bug this module exists to remove from every future finance-v2 call site — see
 * `money.util.spec.ts` for the proof. New `finance-v2`/`sales`/`purchasing` schema
 * columns must be `Decimal @db.Decimal(18, 2)`; this module is how application code
 * touches those values safely.
 *
 * Existing `round2`-style helpers scattered across ~6 services (see the design doc's
 * §1.4 table) are intentionally left in place by this ticket — only future finance-v2
 * code is required to use this module (RAKHAL-331 AC / ticket scope).
 */

/** A money amount. Always a `Prisma.Decimal` — never a `number`. */
export type Money = Prisma.Decimal;

/** Anything `Prisma.Decimal` can be constructed from (number, string, Decimal). */
export type MoneyInput = Prisma.Decimal.Value;

/** Construct a `Money` from a number, string, or existing `Decimal`. */
export function toMoney(value: MoneyInput): Money {
  return new Prisma.Decimal(value);
}

/** The additive identity, ৳0.00. */
export function zero(): Money {
  return new Prisma.Decimal(0);
}

/** `a + b`. */
export function add(a: MoneyInput, b: MoneyInput): Money {
  return toMoney(a).plus(toMoney(b));
}

/** `a - b`. */
export function subtract(a: MoneyInput, b: MoneyInput): Money {
  return toMoney(a).minus(toMoney(b));
}

/**
 * `a * factor` — multiply a money amount by a plain quantity/rate (e.g. unit price ×
 * litres, or a percentage expressed as a decimal fraction). The factor need not itself
 * be money.
 */
export function multiply(a: MoneyInput, factor: MoneyInput): Money {
  return toMoney(a).times(toMoney(factor));
}

/** Sum a list of money amounts; empty list sums to ৳0.00. */
export function sum(values: readonly MoneyInput[]): Money {
  return values.reduce<Money>((total, v) => add(total, v), zero());
}

/** `a > b` */
export function gt(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).greaterThan(toMoney(b));
}

/** `a >= b` */
export function gte(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).greaterThanOrEqualTo(toMoney(b));
}

/** `a < b` */
export function lt(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).lessThan(toMoney(b));
}

/** `a <= b` */
export function lte(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).lessThanOrEqualTo(toMoney(b));
}

/** `a == b` (value equality, not reference — `Decimal('1')` equals `Decimal('1.0')`). */
export function eq(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).equals(toMoney(b));
}

/** `value == 0` */
export function isZero(value: MoneyInput): boolean {
  return toMoney(value).isZero();
}

/** `value < 0` */
export function isNegative(value: MoneyInput): boolean {
  return toMoney(value).isNegative();
}

/** Clamp a value to `>= 0` — totals/balances can never go negative. */
export function clampNonNegative(value: MoneyInput): Money {
  const v = toMoney(value);
  return v.isNegative() ? zero() : v;
}

/**
 * Round to 2 decimal places, half-up (banker's rounding is not used — this matches
 * the existing `round2` convention already live in `billing/domain/money.ts`).
 */
export function round2(value: MoneyInput): Money {
  return toMoney(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Prepare a money value for a `Decimal(18, 2)` storage column: rounded to 2 dp,
 * half-up. Call this immediately before a Prisma write — never persist an
 * un-rounded Decimal into a money column.
 */
export function toStorage(value: MoneyInput): Money {
  return round2(value);
}
