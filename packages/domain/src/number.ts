import { applyDigits } from "./digits.ts";
import type { DigitSystem } from "./locale.ts";

/**
 * Engine-independent number formatting (spec section 5.2).
 * - Grouping: last 3 digits, then groups of 2 (lakh/crore), ',' separator, '.' decimal.
 * - Rounding: half away from zero, performed on the shortest round-trip decimal string of the magnitude
 *   (never on binary arithmetic), so 12.35 -> 12.4 and 2.5 -> 3 on every JS engine.
 * - A result that rounds to zero prints without a sign (deliberate divergence from ICU, which prints "-0").
 * - NaN / Infinity / magnitudes above Number.MAX_SAFE_INTEGER throw RangeError.
 */

export interface NumberFormatOptions {
  /** Maximum fraction digits (rounding precision). Integer 0..20. Default 0. */
  fractionDigits?: number;
  /** Minimum fraction digits (zero padded). Integer 0..fractionDigits. Default 0. */
  minFractionDigits?: number;
  digits?: DigitSystem;
}

export const MAX_FRACTION_DIGITS = 20;

/** Expands the exponent form that String(number) may produce ("1e-7", "1.5e+20") into a plain decimal string. */
function toPlainDecimal(abs: number): string {
  const s = String(abs);
  const m = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
  if (m === null) return s;
  const intPart = m[1] as string;
  const fracPart = m[2] ?? "";
  const exp = Number(m[3]);
  const digits = intPart + fracPart;
  const pointAt = intPart.length + exp; // position of the decimal point within `digits`
  if (pointAt <= 0) return "0." + "0".repeat(-pointAt) + digits;
  if (pointAt >= digits.length) return digits + "0".repeat(pointAt - digits.length);
  return digits.slice(0, pointAt) + "." + digits.slice(pointAt);
}

/** Adds one to a string of decimal digits ("999" -> "1000"). */
function incrementDigits(d: string): string {
  const chars = d.split("");
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] === "9") {
      chars[i] = "0";
    } else {
      chars[i] = String(Number(chars[i]) + 1);
      return chars.join("");
    }
  }
  return "1" + chars.join("");
}

/**
 * Rounds a non-negative plain decimal string ("1234.5", "0.05", "12") half-up (= half away from zero for a magnitude)
 * to exactly `fractionDigits` fraction digits. Returns digit strings; `frac` has exactly fractionDigits chars.
 */
export function roundHalfExpandParts(decimal: string, fractionDigits: number): { int: string; frac: string } {
  if (!/^\d+(\.\d+)?$/.test(decimal)) throw new RangeError(`Not a non-negative decimal string: ${decimal}`);
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > MAX_FRACTION_DIGITS) {
    throw new RangeError(`fractionDigits must be an integer 0..${MAX_FRACTION_DIGITS}`);
  }
  const dot = decimal.indexOf(".");
  const intPart = dot === -1 ? decimal : decimal.slice(0, dot);
  const fracPart = dot === -1 ? "" : decimal.slice(dot + 1);
  if (fracPart.length <= fractionDigits) {
    return { int: intPart, frac: fracPart + "0".repeat(fractionDigits - fracPart.length) };
  }
  const kept = intPart + fracPart.slice(0, fractionDigits);
  const roundUp = fracPart.charCodeAt(fractionDigits) >= 53; // '5'
  const all = roundUp ? incrementDigits(kept) : kept;
  const intLen = all.length - fractionDigits;
  return { int: all.slice(0, intLen), frac: all.slice(intLen) };
}

/** String form of roundHalfExpandParts: "int" or "int.frac" with exactly fractionDigits fraction digits. */
export function roundHalfExpand(decimal: string, fractionDigits: number): string {
  const { int, frac } = roundHalfExpandParts(decimal, fractionDigits);
  return frac === "" ? int : `${int}.${frac}`;
}

/** Indian grouping of a digit string: "1250000" -> "12,50,000". */
export function groupIndian(intString: string): string {
  const stripped = intString.replace(/^0+(?=\d)/, "");
  if (stripped.length <= 3) return stripped;
  const head = stripped.slice(0, -3);
  const tail = stripped.slice(-3);
  const groups: string[] = [];
  for (let end = head.length; end > 0; end -= 2) {
    groups.unshift(head.slice(Math.max(0, end - 2), end));
  }
  return groups.join(",") + "," + tail;
}

/** Shared core. Returns the sign-less formatted magnitude (Latin digits) and whether the printed value is negative. */
export function formatMagnitude(
  value: number,
  maxFraction: number,
  minFraction: number,
): { text: string; negative: boolean } {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError("value must be a finite number");
  const abs = Math.abs(value);
  if (abs > Number.MAX_SAFE_INTEGER) throw new RangeError("magnitude exceeds Number.MAX_SAFE_INTEGER");
  if (!Number.isInteger(minFraction) || minFraction < 0 || minFraction > maxFraction) {
    throw new RangeError("minFractionDigits must be an integer 0..fractionDigits");
  }
  const { int, frac } = roundHalfExpandParts(toPlainDecimal(abs), maxFraction);
  let fracOut = frac;
  while (fracOut.length > minFraction && fracOut.endsWith("0")) fracOut = fracOut.slice(0, -1);
  const text = groupIndian(int) + (fracOut === "" ? "" : "." + fracOut);
  const isZero = /^0+$/.test(int) && /^0*$/.test(frac);
  return { text, negative: value < 0 && !isZero };
}

export function formatNumber(value: number, opts: NumberFormatOptions = {}): string {
  const max = opts.fractionDigits ?? 0;
  const min = opts.minFractionDigits ?? 0;
  const { text, negative } = formatMagnitude(value, max, min);
  return applyDigits((negative ? "-" : "") + text, opts.digits ?? "latn");
}
