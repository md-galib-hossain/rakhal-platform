import "server-only";
import { cookies } from "next/headers";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";
import type { ApiEnvelope } from "@/types/api";
import { COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_USER, REFRESH_COOKIE_MAX_AGE, sessionCookieOpts } from "./cookie-names";
import { decodeAccessToken } from "./jwt";
import { performBackendRefresh } from "./refresh-core";
import type { Session, SessionUser } from "./session-types";

/**
 * Server-only session layer (Route Handlers / Server Actions — see proxy.ts for the
 * Proxy-context equivalent, which can't use `next/headers`). The browser never sees the
 * backend's tokens or even talks to the backend directly — everything here runs on our Next
 * server, which holds three httpOnly first-party cookies:
 *   - rk_at: the backend access JWT (~15min lived, matches backend's own exp claim)
 *   - rk_rt: the backend's own `rakhal_refresh` cookie VALUE (30-day, rotates every refresh)
 *   - rk_user: a small JSON blob of safe-to-cache profile fields from the login/refresh response
 *     body (id/email/name/isEmailVerified) — NOT from `GET /auth/me`, which leaks `passwordHash`
 *     (found live-testing this ticket; flagged as a backend bug, see PROJECT_PROGRESS.md).
 */

interface BackendLoginData {
  accessToken: string;
  sessionId: string;
  user: SessionUser;
}

async function backendFetch<T>(path: string, init: RequestInit & { cookieHeader?: string } = {}): Promise<{
  envelope: ApiEnvelope<T>;
  setCookies: string[];
}> {
  const { cookieHeader, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${serverEnv.API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...headers,
      },
      cache: "no-store",
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  const envelope = (await res.json()) as ApiEnvelope<T>;
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (!envelope.success) {
    throw new ApiError(envelope.code, envelope.message, res.status, envelope.requestId);
  }
  return { envelope, setCookies };
}

function extractCookieValue(setCookieHeaders: string[], name: string): string | undefined {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return undefined;
}

/** Only callable from a Server Action or Route Handler. */
async function setSessionCookies(accessToken: string, refreshCookieValue: string, user: SessionUser) {
  const store = await cookies();
  const claims = decodeAccessToken(accessToken);
  const accessMaxAge = claims ? Math.max(claims.exp - Math.floor(Date.now() / 1000), 0) : 900;
  store.set(COOKIE_ACCESS, accessToken, { ...sessionCookieOpts, maxAge: accessMaxAge });
  store.set(COOKIE_REFRESH, refreshCookieValue, { ...sessionCookieOpts, maxAge: REFRESH_COOKIE_MAX_AGE });
  store.set(COOKIE_USER, JSON.stringify(user), { ...sessionCookieOpts, maxAge: REFRESH_COOKIE_MAX_AGE });
}

/** Only callable from a Server Action or Route Handler. */
export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(COOKIE_ACCESS);
  store.delete(COOKIE_REFRESH);
  store.delete(COOKIE_USER);
}

/**
 * Two-step farm bootstrap (ARCHITECTURE.md §4): a `farmId`-less call logs in against the special
 * "bootstrap" farm to list the user's real farms, then auto-selects when there's exactly one.
 * Only callable from a Server Action or Route Handler (writes cookies on success).
 */
export type LoginResult =
  | { status: "ok"; user: SessionUser }
  | { status: "select-farm"; farms: { id: string; name: string; slug: string; role: string }[] }
  | { status: "no-farms" };

export async function loginWithBackend(email: string, password: string, farmId?: string): Promise<LoginResult> {
  if (farmId) {
    const { envelope, setCookies } = await backendFetch<BackendLoginData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, farmId }),
    });
    if (!envelope.success) throw new ApiError(envelope.code, envelope.message, 401);
    const refreshCookie = extractCookieValue(setCookies, "rakhal_refresh");
    if (!refreshCookie) throw new ApiError("LOGIN_NO_REFRESH_COOKIE", "Backend did not issue a refresh cookie.", 500);
    await setSessionCookies(envelope.data.accessToken, refreshCookie, envelope.data.user);
    return { status: "ok", user: envelope.data.user };
  }

  // Bootstrap step: log in against the placeholder farm just to list real farms.
  const bootstrap = await backendFetch<BackendLoginData>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, farmId: "bootstrap" }),
  });
  const farms = await backendFetch<{ id: string; name: string; slug: string; status: string; role: string }[]>(
    "/farms",
    { headers: { Authorization: `Bearer ${bootstrap.envelope.success ? bootstrap.envelope.data.accessToken : ""}` } },
  );
  if (!farms.envelope.success) throw new ApiError(farms.envelope.code, farms.envelope.message, 500);

  if (farms.envelope.data.length === 0) return { status: "no-farms" };
  if (farms.envelope.data.length === 1) {
    return loginWithBackend(email, password, farms.envelope.data[0].id);
  }
  return { status: "select-farm", farms: farms.envelope.data };
}

/** Single-flight refresh, cookie access via `next/headers`. Route Handler / Server Action only. */
let refreshInFlight: Promise<Session | null> | null = null;

export async function refreshSession(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<Session | null> {
  const store = await cookies();
  const refreshCookieValue = store.get(COOKIE_REFRESH)?.value;
  const cachedAccess = store.get(COOKIE_ACCESS)?.value;
  const farmId = cachedAccess ? decodeAccessToken(cachedAccess)?.farmId : undefined;
  if (!refreshCookieValue || !farmId) {
    await clearSessionCookies();
    return null;
  }

  const result = await performBackendRefresh(refreshCookieValue, farmId);
  if (!result) {
    await clearSessionCookies();
    return null;
  }

  // Prefer the cached login-time user profile — refresh's embedded user has been observed live
  // to carry a stale `isEmailVerified` claim vs. login's.
  const cachedUser = store.get(COOKIE_USER)?.value;
  const user: SessionUser = cachedUser ? JSON.parse(cachedUser) : result.user;
  await setSessionCookies(result.accessToken, result.refreshCookie, user);

  const claims = decodeAccessToken(result.accessToken);
  return { accessToken: result.accessToken, farmId, sessionId: claims?.sessionId ?? "", user };
}

/** Best-effort — clears local cookies even if the backend call fails (ARCHITECTURE.md §5.4). */
export async function logoutSession(): Promise<void> {
  const store = await cookies();
  const accessToken = store.get(COOKIE_ACCESS)?.value;
  const refreshCookieValue = store.get(COOKIE_REFRESH)?.value;
  if (accessToken && refreshCookieValue) {
    try {
      const csrfRes = await fetch(`${serverEnv.API_BASE_URL}/auth/csrf`, { cache: "no-store" });
      const csrfEnvelope = (await csrfRes.json()) as ApiEnvelope<{ csrfToken: string }>;
      const csrfCookie = extractCookieValue(csrfRes.headers.getSetCookie?.() ?? [], "rakhal_csrf");
      if (csrfEnvelope.success && csrfCookie) {
        await fetch(`${serverEnv.API_BASE_URL}/auth/logout`, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-CSRF-Token": csrfEnvelope.data.csrfToken,
            Cookie: `rakhal_refresh=${refreshCookieValue}; rakhal_csrf=${csrfCookie}`,
          },
          body: "{}",
        });
      }
    } catch {
      // best-effort — local cookies are cleared regardless
    }
  }
  await clearSessionCookies();
}

/** Best-effort — revokes every session for the current user (`POST /auth/logout-all`, needs
 * `CsrfGuard`) and clears local cookies regardless (RFE-007, mirrors `logoutSession` above). */
export async function logoutAllSessions(): Promise<{ success: boolean; revokedSessions?: number }> {
  const store = await cookies();
  const accessToken = store.get(COOKIE_ACCESS)?.value;
  const refreshCookieValue = store.get(COOKIE_REFRESH)?.value;
  let result: { success: boolean; revokedSessions?: number } = { success: true };
  if (accessToken && refreshCookieValue) {
    try {
      const csrfRes = await fetch(`${serverEnv.API_BASE_URL}/auth/csrf`, { cache: "no-store" });
      const csrfEnvelope = (await csrfRes.json()) as ApiEnvelope<{ csrfToken: string }>;
      const csrfCookie = extractCookieValue(csrfRes.headers.getSetCookie?.() ?? [], "rakhal_csrf");
      if (csrfEnvelope.success && csrfCookie) {
        const logoutAllRes = await fetch(`${serverEnv.API_BASE_URL}/auth/logout-all`, {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-CSRF-Token": csrfEnvelope.data.csrfToken,
            Cookie: `rakhal_refresh=${refreshCookieValue}; rakhal_csrf=${csrfCookie}`,
          },
        });
        const logoutAllEnvelope = (await logoutAllRes.json()) as ApiEnvelope<{
          success: boolean;
          revokedSessions?: number;
        }>;
        if (logoutAllEnvelope.success) result = logoutAllEnvelope.data;
      }
    } catch {
      // best-effort — local cookies are cleared regardless
    }
  }
  await clearSessionCookies();
  return result;
}

/**
 * Read-only session lookup for Server Components. Proactively refreshes are `proxy.ts`'s job
 * (it can write cookies on every request); by the time an RSC renders, the access token should
 * already be fresh. If it isn't (e.g. local `next dev` without the proxy path warmed), this
 * still returns the cached claims — the generic backend proxy handles reactive 401 recovery for
 * client-side calls, and pages simply pass a near-expired token through until the next request.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const accessToken = store.get(COOKIE_ACCESS)?.value;
  const userJson = store.get(COOKIE_USER)?.value;
  if (!accessToken || !userJson) return null;
  const claims = decodeAccessToken(accessToken);
  if (!claims) return null;
  try {
    return {
      accessToken,
      farmId: claims.farmId,
      sessionId: claims.sessionId,
      user: JSON.parse(userJson) as SessionUser,
    };
  } catch {
    return null;
  }
}

export type { Session, SessionUser };
