import type { Locale } from "@/lib/constants/i18n";

/**
 * Lakh/crore grouping in BOTH locales, Latin digits in BOTH locales — verified in Node's ICU
 * (RFE-002): `en-BD` does NOT group as lakhs (only `en-IN` does), and plain `bn-BD` defaults to
 * Bengali digits (০-৯) unless the `-u-nu-latn` numbering-system extension is applied.
 * See docs/ARCHITECTURE.md §4 "Money" for the full rationale.
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

/** Medium date and time, e.g. "9 Jul, 2026, 8:00 AM" (en) / "৯ জুল, ২০২৬, 8:00 AM" (bn). */
export function formatDateTime(date: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(
    dateLocale[locale],
    options ?? { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
  ).format(d);
}

/** Relative time, e.g. "2 hours ago" — used by activity feeds / recent-activity widgets. */
export function formatRelativeTime(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(dateLocale[locale], { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit) {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(diffSec, "second");
}

/** Largest change percentage shown as a number; anything bigger reads "999%+" (a 100000% jump is noise, not insight). */
export const MAX_DISPLAY_PCT = 999;

/** Magnitude of a change percentage, capped — "12.5%", "999%+". Callers add the sign / arrow themselves. */
export function formatPct(pct: number): string {
  const abs = Math.abs(pct);
  return abs > MAX_DISPLAY_PCT ? `${MAX_DISPLAY_PCT}%+` : `${abs}%`;
}

/** Signed, capped change: "+12.5%", "−3%", "999%+" (over the cap the sign is implied, so no leading "+"). */
export function formatSignedPct(pct: number): string {
  if (Math.abs(pct) > MAX_DISPLAY_PCT) return pct > 0 ? `${MAX_DISPLAY_PCT}%+` : `−${MAX_DISPLAY_PCT}%+`;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

/**
 * Label for a *business date* (a transaction/entry date the user picked, not a moment in time): "today", "yesterday",
 * "3 days ago", then a calendar date. A relative-*time* label ("in 5 hours") is wrong here because a date-only value
 * can land later today than `now`.
 */
export function formatBusinessDay(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(d) - startOf(new Date())) / 86_400_000);
  if (dayDiff <= 0 && dayDiff >= -6) {
    return new Intl.RelativeTimeFormat(dateLocale[locale], { numeric: "auto" }).format(dayDiff, "day");
  }
  return formatDate(d, locale, { day: "numeric", month: "short", year: "numeric" });
}
