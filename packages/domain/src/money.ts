import { applyDigits } from "./digits.ts";
import type { DigitSystem } from "./locale.ts";
import { formatMagnitude } from "./number.ts";

/** The taka sign, U+09F3. */
export const TAKA_SIGN = "৳";

export interface MoneyFormatOptions {
  /** Default 'latn'. */
  digits?: DigitSystem;
  /** Fraction digits, always shown (zero padded). Default 0. */
  fractionDigits?: number;
}

/**
 * Taka sign prefix + lakh grouping (identical in bn and en; only the digit system varies).
 * Negatives follow web parity: the sign goes after the symbol, taka sign then minus (owner decision O7).
 * Throws RangeError for NaN, Infinity and magnitudes above Number.MAX_SAFE_INTEGER.
 */
export function formatMoney(amount: number, opts: MoneyFormatOptions = {}): string {
  const fraction = opts.fractionDigits ?? 0;
  const { text, negative } = formatMagnitude(amount, fraction, fraction);
  return applyDigits(TAKA_SIGN + (negative ? "-" : "") + text, opts.digits ?? "latn");
}
