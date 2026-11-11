import { applyDigits } from "./digits.ts";
import type { DigitSystem, Locale } from "./locale.ts";

/**
 * Asia/Dhaka date formatting by integer arithmetic on UTC time (spec section 5.2).
 * Bangladesh is fixed at UTC+06:00 with no DST, so no timezone database is needed. Only UTC getters are used;
 * the device's local timezone never influences the result.
 */

export const DHAKA_OFFSET_MINUTES = 360;

export type DateStyle = "short" | "long";

export interface DhakaParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** 0 = Sunday .. 6 = Saturday */
  weekday: number;
  hour: number;
  minute: number;
}

export const MONTHS_LONG: Record<Locale, readonly string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};

/**
 * Short names match ICU/CLDR (Node 24 `Intl.DateTimeFormat("bn")` / `"en-US"`; enforced by test/differential-names.test.ts).
 * English September is "Sep" (en-US and date-fns "MMM", which the web prints), not en-GB "Sept": a deliberate,
 * documented divergence.
 */
export const MONTHS_SHORT: Record<Locale, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  bn: ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্ট", "অক্টো", "নভেম্বর", "ডিসে"],
};

export const WEEKDAYS_LONG: Record<Locale, readonly string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
};

export const WEEKDAYS_SHORT: Record<Locale, readonly string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  bn: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"],
};

function toMillis(input: Date | number): number {
  const ms = typeof input === "number" ? input : input.getTime();
  if (!Number.isFinite(ms)) throw new RangeError("Invalid date");
  return ms;
}

export function dhakaParts(input: Date | number): DhakaParts {
  const shifted = new Date(toMillis(input) + DHAKA_OFFSET_MINUTES * 60_000);
  if (Number.isNaN(shifted.getTime())) throw new RangeError("Invalid date");
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const pad2 = (n: number) => (n < 10 ? "0" + n : String(n));

/**
 * Day-of-record key in farm (Dhaka) time: "YYYY-MM-DD". Always Latin digits (it is a key, not display text).
 * Throws RangeError for invalid dates and for Dhaka years outside 0..9999 (the key has exactly 4 year digits).
 */
export function farmDayKey(input: Date | number): string {
  const p = dhakaParts(input);
  if (p.year < 0 || p.year > 9999) throw new RangeError("Year outside 0..9999");
  return `${String(p.year).padStart(4, "0")}-${pad2(p.month)}-${pad2(p.day)}`;
}

export interface DateFormatOptions {
  locale: Locale;
  /** Default "short". */
  style?: DateStyle;
  /** Default "latn". */
  digits?: DigitSystem;
}

/**
 * short: "11 Nov, 2026" / "১১ নভেম্বর, ২০২৬" (web `d MMM, yyyy`).
 * long:  "11 November, 2026" / "১১ নভেম্বর, ২০২৬".
 */
export function formatDate(input: Date | number, opts: DateFormatOptions): string {
  const p = dhakaParts(input);
  const months = opts.style === "long" ? MONTHS_LONG[opts.locale] : MONTHS_SHORT[opts.locale];
  const text = `${p.day} ${months[p.month - 1]}, ${p.year}`;
  return applyDigits(text, opts.digits ?? "latn");
}

/** 24-hour "HH:mm" in Dhaka time. */
export function formatTime(input: Date | number, digits: DigitSystem = "latn"): string {
  const p = dhakaParts(input);
  return applyDigits(`${pad2(p.hour)}:${pad2(p.minute)}`, digits);
}

/** Date + 24-hour time, e.g. "12 Nov, 2026, 00:30". */
export function formatDateTime(input: Date | number, opts: DateFormatOptions): string {
  return `${formatDate(input, opts)}, ${formatTime(input, opts.digits ?? "latn")}`;
}
