"use client";

import { apiFetch } from "@/lib/api/client";
import { unwrapEnvelope } from "@/lib/api/envelope";
import { NetworkError } from "@/lib/api/errors";
import type { ApiEnvelope } from "@/types/api";
import type { LogoutAllResult, ProfileUser, RevokeSessionResult, SessionItem } from "./types";

/**
 * All routes here need only `JwtAuthGuard, SessionGuard` (no `CsrfGuard`) per
 * `auth.controller.ts` — safe to go through the generic `/api/backend/[...path]` proxy, unlike
 * `POST /auth/change-password` or `POST /auth/logout(-all)`'s cookie-clearing variant, which need
 * bespoke CSRF/cookie handling `lib/auth/session.ts` already owns (out of this ticket's lane).
 */
export const profileApi = {
  me(): Promise<ProfileUser> {
    return apiFetch<ProfileUser>("/auth/me");
  },

  updateLanguage(preferredLanguage: "BN" | "EN"): Promise<ProfileUser> {
    return apiFetch<ProfileUser>("/auth/me/language", { method: "PATCH", body: { preferredLanguage } });
  },

  sessions(): Promise<SessionItem[]> {
    return apiFetch<SessionItem[]>("/auth/sessions");
  },

  revokeSession(sessionId: string): Promise<RevokeSessionResult> {
    return apiFetch<RevokeSessionResult>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
  },
};

/** `POST /auth/logout-all` needs `CsrfGuard` + clears the refresh cookie — goes through the
 * bespoke `/api/auth/logout` route's sibling rather than the generic proxy. See `lib/auth/session.ts`. */
export async function logoutAllDevices(): Promise<LogoutAllResult> {
  let res: Response;
  try {
    res = await fetch("/api/auth/logout-all", { method: "POST", credentials: "same-origin" });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  const envelope = (await res.json()) as ApiEnvelope<LogoutAllResult>;
  return unwrapEnvelope(envelope, res.status);
}
