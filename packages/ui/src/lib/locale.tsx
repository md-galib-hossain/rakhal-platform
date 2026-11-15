"use client";

import { createContext, useContext } from "react";

export type Locale = "bn" | "en";

/**
 * Lakh/crore grouping in BOTH locales, Latin digits in BOTH locales — verified in Node's ICU:
 * `en-BD` does NOT group as lakhs (only `en-IN` does), and plain `bn-BD` defaults to Bengali
 * digits (০-৯) unless the `-u-nu-latn` numbering-system extension is applied. Ported from
 * apps/web/lib/format.ts (see docs/ARCHITECTURE.md §4 "Money" there for the full rationale) —
 * duplicated here rather than re-exported since this package has no dependency on apps/web.
 */
const numberLocale: Record<Locale, string> = {
  bn: "bn-BD-u-nu-latn",
  en: "en-IN",
};

const dateLocale: Record<Locale, string> = {
  bn: "bn-BD-u-nu-latn",
  en: "en-US",
};

/** ৳ formatted with lakh grouping, Latin digits, no decimals (money amounts are whole paisa-free Taka). */
export function formatMoney(amount: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(numberLocale[locale], {
    maximumFractionDigits: 0,
  }).format(amount);
  return `৳${formatted}`;
}

/** Plain number, lakh grouping, Latin digits — for non-currency counts (AQR score, litres, etc). */
export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(numberLocale[locale], options).format(value);
}

/** Medium date, e.g. "9 Jul, 2026" (en) / "৯ জুল, ২০২৬"-style but with Latin digits in bn. */
export function formatDate(date: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(dateLocale[locale], options ?? { day: "numeric", month: "short", year: "numeric" }).format(d);
}

const LocaleContext = createContext<Locale | null>(null);

/** Wrap once near the app's root, forwarding whatever locale source the app already uses
 * (e.g. next-intl's own `useLocale()`). Every locale-aware shared component reads through
 * `useLocale()` below instead of taking a `locale` prop, so moving one from `apps/web` into
 * this package never touches call sites beyond the import path. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Throws if used outside a `LocaleProvider` — a shared component silently defaulting to the
 * wrong locale is worse than a loud error during development. */
export function useLocale(): Locale {
  const locale = useContext(LocaleContext);
  if (locale === null) {
    throw new Error("useLocale() must be called within a <LocaleProvider>.");
  }
  return locale;
}
