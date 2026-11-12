export const locales = ["bn", "en"] as const;
export type Locale = (typeof locales)[number];

/** Bangla-first per product decision (2026-07-09) — English is opt-in via the topbar toggle. */
export const defaultLocale: Locale = "bn";

/** Matches next-intl's own convention for cookie-based (non-routed) locale persistence. */
export const localeCookieName = "NEXT_LOCALE";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
