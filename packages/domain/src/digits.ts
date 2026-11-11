import type { DigitSystem } from "./locale.ts";

const BENGALI_ZERO = 0x09e6;

/** Maps ASCII 0-9 to Bangla digits U+09E6-U+09EF. Every other character (separators, symbols, letters) is unchanged. */
export function toBanglaDigits(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c >= 48 && c <= 57 ? String.fromCharCode(BENGALI_ZERO + (c - 48)) : s.charAt(i);
  }
  return out;
}

/** Throws RangeError for a digit system other than "latn" | "beng" (e.g. an unvalidated runtime value). */
export function applyDigits(s: string, digits: DigitSystem): string {
  if (digits !== "latn" && digits !== "beng") throw new RangeError(`Unknown digit system: ${String(digits)}`);
  return digits === "beng" ? toBanglaDigits(s) : s;
}
