import "server-only";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";
import type { ApiEnvelope } from "@/types/api";
import type { SessionUser } from "./session-types";

/**
 * Pure, cookie-API-agnostic core of the refresh flow — takes/returns plain string values so it
 * can be called both from Route Handlers/Server Actions (which read/write cookies via
 * `next/headers`) and from `proxy.ts` (which uses `NextRequest`/`NextResponse` cookies — a
 * different API that can't use `next/headers`). See lib/auth/session.ts for the wrapped version.
 *
 * Re-derives the empirically-verified rule: the backend's CSRF token invalidates across a
 * login/session boundary, so a fresh one is fetched immediately before every refresh call and
 * discarded — never cached.
 */
export async function performBackendRefresh(
  refreshCookieValue: string,
  farmId: string,
): Promise<{ accessToken: string; refreshCookie: string; user: SessionUser } | null> {
  try {
    const csrfRes = await fetch(`${serverEnv.API_BASE_URL}/auth/csrf`, { cache: "no-store" });
    const csrfEnvelope = (await csrfRes.json()) as ApiEnvelope<{ csrfToken: string }>;
    const csrfCookie = extractCookieValue(csrfRes.headers.getSetCookie?.() ?? [], "rakhal_csrf");
    if (!csrfEnvelope.success || !csrfCookie) return null;

    const refreshRes = await fetch(`${serverEnv.API_BASE_URL}/auth/refresh`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfEnvelope.data.csrfToken,
        Cookie: `rakhal_refresh=${refreshCookieValue}; rakhal_csrf=${csrfCookie}`,
      },
      body: JSON.stringify({ farmId }),
    });
    const envelope = (await refreshRes.json()) as ApiEnvelope<{
      accessToken: string;
      sessionId: string;
      user: SessionUser;
    }>;
    if (!envelope.success) return null;

    const newRefreshCookie =
      extractCookieValue(refreshRes.headers.getSetCookie?.() ?? [], "rakhal_refresh") ?? refreshCookieValue;
    return { accessToken: envelope.data.accessToken, refreshCookie: newRefreshCookie, user: envelope.data.user };
  } catch (cause) {
    if (cause instanceof ApiError) return null;
    throw new NetworkError(cause);
  }
}

function extractCookieValue(setCookieHeaders: string[], name: string): string | undefined {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return undefined;
}
