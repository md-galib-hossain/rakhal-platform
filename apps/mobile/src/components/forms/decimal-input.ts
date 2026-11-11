/**
 * Pure decimal-entry logic behind StepperField (spec 2.4). No React / React Native imports: node --test covers it.
 *
 * Input side: `parseDecimalInput` accepts Latin digits AND Bangla digits (U+09E6-U+09EF), `.` or `,` as the decimal
 * separator (Android `decimal-pad` follows the device locale), strips spaces, and returns a canonical Latin string.
 * It REJECTS (kind 'invalid') anything else: signs, exponents, letters, two separators, and more fraction digits
 * than `decimals`. Rejecting rather than rounding is deliberate: a farmer typing 12.55 into a 1-decimal milk field
 * must not get 12.6 silently stored. The component treats 'invalid' as "ignore that keystroke".
 *
 * Step side: arithmetic runs on integers scaled by 10^decimals, so 0.1 + 0.2 is exactly 0.3 (no float drift).
 * Money/measure formatting for DISPLAY elsewhere stays with the caller (`useFormat`); `toInputString` only builds
 * the plain editable string (no grouping) in the user's digit system.
 */
import { applyDigits, type DigitSystem } from '@rakhal/domain';

export type DecimalKind = 'empty' | 'partial' | 'valid' | 'invalid';

export interface DecimalParse {
  kind: DecimalKind;
  /** null for empty / invalid / a lone separator. A trailing-separator draft ("12.") carries its value (12). */
  value: number | null;
  /** Canonical Latin-digit string with `.` as the separator ('' for empty / invalid). */
  normalized: string;
}

/** Most significant digits accepted; beyond this a double starts losing precision. */
export const MAX_SIGNIFICANT_DIGITS = 15;

const BANGLA_ZERO = 0x09e6;
const BANGLA_NINE = 0x09ef;

function banglaToLatin(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c >= BANGLA_ZERO && c <= BANGLA_NINE ? String.fromCharCode(48 + (c - BANGLA_ZERO)) : s.charAt(i);
  }
  return out;
}

const INVALID: DecimalParse = { kind: 'invalid', value: null, normalized: '' };

export function parseDecimalInput(text: string, options: { decimals: number }): DecimalParse {
  const decimals = Math.max(0, Math.floor(options.decimals));
  const s = banglaToLatin(text.replace(/\s/g, ''));
  if (s === '') return { kind: 'empty', value: null, normalized: '' };
  if (!/^[0-9.,]+$/.test(s)) return INVALID;

  const separators = s.match(/[.,]/g)?.length ?? 0;
  if (separators > 1) return INVALID;

  const at = s.search(/[.,]/);
  const hasSeparator = at !== -1;
  const intRaw = hasSeparator ? s.slice(0, at) : s;
  const frac = hasSeparator ? s.slice(at + 1) : '';

  if (hasSeparator && decimals === 0) return INVALID;
  if (frac.length > decimals) return INVALID;
  if (intRaw.length + frac.length > MAX_SIGNIFICANT_DIGITS) return INVALID;

  const int = intRaw.replace(/^0+(?=\d)/, '') || '0';
  if (intRaw === '' && frac === '') return { kind: 'partial', value: null, normalized: '0.' }; // a lone separator

  if (hasSeparator && frac === '') return { kind: 'partial', value: Number(int), normalized: `${int}.` };
  const normalized = hasSeparator ? `${int}.${frac}` : int;
  return { kind: 'valid', value: Number(normalized), normalized };
}

/** Plain editable string for `value` (no grouping, trailing zeros trimmed) in the given digit system. '' for null/NaN/Infinity. */
export function toInputString(value: number | null, decimals: number, digits: DigitSystem): string {
  if (value === null || !Number.isFinite(value)) return '';
  const places = Math.min(20, Math.max(0, Math.floor(decimals)));
  let text = value.toFixed(places);
  if (text.includes('.')) text = text.replace(/\.?0+$/, '');
  if (text === '-0') text = '0';
  return applyDigits(text, digits);
}

export interface Range {
  min?: number;
  max?: number;
}

export function clampToRange(value: number, { min, max }: Range): number {
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

export function exceedsMax(value: number, max: number | undefined): boolean {
  return max !== undefined && value > max;
}

export interface StepBounds extends Range {
  step: number;
  decimals: number;
}

const isNumber = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * One +/- step. `null`/NaN counts as `min` (default 0) for +, and stays null for -. Result is clamped to
 * [min, max] and rounded to `decimals` on an integer grid. A non-positive / NaN step (or one finer than the
 * grid) leaves the value unchanged.
 */
export function stepValue(current: number | null, direction: 1 | -1, bounds: StepBounds): number | null {
  const { step, min, max } = bounds;
  const scale = 10 ** Math.max(0, Math.floor(bounds.decimals));
  const stepUnits = Math.round(step * scale);
  if (!(step > 0) || !Number.isFinite(step) || stepUnits === 0) return isNumber(current) ? current : null;

  let base: number;
  if (isNumber(current)) base = current;
  else if (direction === -1) return null;
  else base = min ?? 0;

  const next = (Math.round(base * scale) + direction * stepUnits) / scale;
  return clampToRange(next, { min, max });
}

/** Whether the +/- button for `direction` should be enabled. */
export function canStep(current: number | null, direction: 1 | -1, bounds: StepBounds): boolean {
  if (direction === -1) {
    if (!isNumber(current)) return false;
    return bounds.min === undefined || current > bounds.min;
  }
  if (!isNumber(current)) return true;
  return bounds.max === undefined || current < bounds.max;
}
