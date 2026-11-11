/** Locale, digit-system and script types. Pure; no engine locale APIs. */

export type Locale = "bn" | "en";
export const DEFAULT_LOCALE: Locale = "bn";

/** latn = 0-9, beng = Bangla digits U+09E6-U+09EF. Latin is the product default. */
export type DigitSystem = "latn" | "beng";
export const DEFAULT_DIGITS: DigitSystem = "latn";

export type TextScript = "latin" | "bengali";

export function isLocale(value: unknown): value is Locale {
  return value === "bn" || value === "en";
}

/** Returns the locale for a valid raw value, otherwise undefined. Never throws. */
export function parseLocale(raw: unknown): Locale | undefined {
  return isLocale(raw) ? raw : undefined;
}

export function isDigitSystem(value: unknown): value is DigitSystem {
  return value === "latn" || value === "beng";
}

export function parseDigits(raw: unknown): DigitSystem | undefined {
  return isDigitSystem(raw) ? raw : undefined;
}

export function scriptForLocale(locale: Locale): TextScript {
  return locale === "bn" ? "bengali" : "latin";
}

/** Any codepoint in the Bengali block U+0980-U+09FF makes the whole string "bengali"; otherwise the fallback. */
export function scriptOfText(text: string, fallback: TextScript): TextScript {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0980 && c <= 0x09ff) return "bengali";
  }
  return fallback;
}
