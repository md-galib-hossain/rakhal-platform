import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/constants/i18n";

/**
 * No URL locale routing — this is an authenticated SaaS app, not per-locale marketing pages.
 * Locale is a user preference: cookie-persisted client-side, mirrored server-side via
 * `PATCH /auth/me/language` once auth exists (RFE-003/007).
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
