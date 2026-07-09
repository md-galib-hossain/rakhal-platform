"use server";

import { cookies } from "next/headers";
import { localeCookieName, type Locale } from "@/lib/constants/i18n";

/**
 * Persists the UI language locally. Once auth exists (RFE-003), the topbar language
 * toggle (RFE-005/007) also calls `PATCH /auth/me/language` so the choice survives
 * across devices — this action only owns the cookie half of that contract.
 */
export async function setLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
