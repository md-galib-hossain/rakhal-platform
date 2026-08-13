import "server-only";
import { cookies } from "next/headers";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";
import type { ApiEnvelope } from "@/types/api";
import { COOKIE_ACCESS, COOKIE_FARM, COOKIE_REFRESH, COOKIE_USER, REFRESH_COOKIE_MAX_AGE, sessionCookieOpts } from "./cookie-names";
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
  farmId: string;
  needsFarm: boolean;
  farms?: { id: string; name: string; slug: string; role: string }[];
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

/** Only callable from a Server Action or Route Handler. `farmId` is persisted in its own
 * 30-day cookie (matches rk_rt) rather than re-derived by decoding rk_at each time — rk_at's
 * cookie expires with the access token itself (~15min), well before the refresh token does, so
 * a farmId sourced only from it disappears exactly when a stale-session refresh needs it most. */
async function setSessionCookies(
  accessToken: string,
  refreshCookieValue: string,
  user: SessionUser,
  farmId: string,
) {
  const store = await cookies();
  const claims = decodeAccessToken(accessToken);
  const accessMaxAge = claims ? Math.max(claims.exp - Math.floor(Date.now() / 1000), 0) : 900;
  store.set(COOKIE_ACCESS, accessToken, { ...sessionCookieOpts, maxAge: accessMaxAge });
  store.set(COOKIE_REFRESH, refreshCookieValue, { ...sessionCookieOpts, maxAge: REFRESH_COOKIE_MAX_AGE });
  store.set(COOKIE_USER, JSON.stringify(user), { ...sessionCookieOpts, maxAge: REFRESH_COOKIE_MAX_AGE });
  store.set(COOKIE_FARM, farmId, { ...sessionCookieOpts, maxAge: REFRESH_COOKIE_MAX_AGE });
}

/** Only callable from a Server Action or Route Handler. */
export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(COOKIE_ACCESS);
  store.delete(COOKIE_REFRESH);
  store.delete(COOKIE_USER);
  store.delete(COOKIE_FARM);
}

/**
 * Single-call login (I2/I3 fix): the backend now resolves `farmId` server-side when omitted — 0
 * memberships → `needsFarm` + no `farms`, 1 → auto-scoped, 2+ → `needsFarm` + a `farms` list — and
 * issues a real session (refresh cookie included) in every case, so a multi-farm pick only needs
 * `selectFarm` below (an `/auth/refresh`, no second password submission) rather than a second
 * `/auth/login`. Only callable from a Server Action or Route Handler (writes cookies on success).
 */
export type LoginResult =
  | { status: "ok"; user: SessionUser }
  | { status: "select-farm"; farms: { id: string; name: string; slug: string; role: string }[] }
  | { status: "no-farms" };

export async function loginWithBackend(email: string, password: string, farmId?: string): Promise<LoginResult> {
  const { envelope, setCookies } = await backendFetch<BackendLoginData>("/auth/login", {
    method: "POST",
    body: JSON.stringify(farmId ? { email, password, farmId } : { email, password }),
  });
  if (!envelope.success) throw new ApiError(envelope.code, envelope.message, 401);

  const refreshCookie = extractCookieValue(setCookies, "rakhal_refresh");
  if (!refreshCookie) throw new ApiError("LOGIN_NO_REFRESH_COOKIE", "Backend did not issue a refresh cookie.", 500);
  await setSessionCookies(envelope.data.accessToken, refreshCookie, envelope.data.user, envelope.data.farmId);

  if (!envelope.data.needsFarm) return { status: "ok", user: envelope.data.user };
  if (envelope.data.farms && envelope.data.farms.length > 0) {
    return { status: "select-farm", farms: envelope.data.farms };
  }
  return { status: "no-farms" };
}

/**
 * Escalate an already-persisted session (bootstrap-scoped, or "" from the multi-farm branch
 * above) onto a chosen farm — reuses the refresh cookie `loginWithBackend` already set, so the
 * farm picker never re-sends the password (I3). Only callable from a Server Action or Route
 * Handler.
 */
export async function selectFarm(farmId: string): Promise<{ user: SessionUser }> {
  const store = await cookies();
  const refreshCookieValue = store.get(COOKIE_REFRESH)?.value;
  if (!refreshCookieValue) throw new ApiError("NO_SESSION", "Not authenticated.", 401);

  const refreshed = await performBackendRefresh(refreshCookieValue, farmId);
  if (!refreshed) throw new ApiError("FARM_ACTIVATE_FAILED", "Selecting the farm failed. Please log in again.", 500);

  await setSessionCookies(refreshed.accessToken, refreshed.refreshCookie, refreshed.user, farmId);
  return { user: refreshed.user };
}

/**
 * Onboarding step after a "no-farms" login: creates the user's first farm using the bootstrap
 * session already persisted above, then escalates to a real farm-scoped token via `/auth/refresh`
 * (no password re-entry needed — `FarmContextGuard` validates real membership on every farm-scoped
 * route afterward, so trusting the requested `farmId` here is safe). Only callable from a Server
 * Action or Route Handler.
 */
export async function createFirstFarm(name: string, description?: string): Promise<{ user: SessionUser }> {
  const store = await cookies();
  const accessToken = store.get(COOKIE_ACCESS)?.value;
  const refreshCookieValue = store.get(COOKIE_REFRESH)?.value;
  if (!accessToken || !refreshCookieValue) {
    throw new ApiError("NO_SESSION", "Not authenticated.", 401);
  }

  // LGL-02: FarmService.create 403s until the current ToS + Privacy are accepted. The onboarding
  // form only submits here once the user has checked the agree box, so accept-all is safe.
  await backendFetch("/legal/consent", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const created = await backendFetch<{ id: string }>("/farms", {
    method: "POST",
    body: JSON.stringify({ name, description }),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!created.envelope.success) throw new ApiError(created.envelope.code, created.envelope.message, 500);

  const refreshed = await performBackendRefresh(refreshCookieValue, created.envelope.data.id);
  if (!refreshed) {
    throw new ApiError(
      "FARM_ACTIVATE_FAILED",
      "Farm created but activating the session failed. Please log in again.",
      500,
    );
  }

  await setSessionCookies(refreshed.accessToken, refreshed.refreshCookie, refreshed.user, created.envelope.data.id);
  return { user: refreshed.user };
}

/**
 * Redeem a team invite token with the already-authenticated caller, then escalate the session
 * onto the invite's farm — same two-step shape as `createFirstFarm` above (backend call with the
 * current token, then `performBackendRefresh` to mint a farm-scoped one; no password re-entry).
 * The backend's `acceptInvite` rejects with 403 if the caller's account email doesn't match the
 * invite's — that `ApiError` propagates to the caller of this function unchanged.
 */
export async function acceptTeamInvite(token: string): Promise<{ user: SessionUser; farmId: string }> {
  const store = await cookies();
  const accessToken = store.get(COOKIE_ACCESS)?.value;
  const refreshCookieValue = store.get(COOKIE_REFRESH)?.value;
  if (!accessToken || !refreshCookieValue) {
    throw new ApiError("NO_SESSION", "Not authenticated.", 401);
  }

  const accepted = await backendFetch<{ farm_id: string; farm_name: string; role: string }>(
    "/onboarding/accept-invite",
    { method: "POST", body: JSON.stringify({ token }), headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!accepted.envelope.success) throw new ApiError(accepted.envelope.code, accepted.envelope.message, 500);

  const refreshed = await performBackendRefresh(refreshCookieValue, accepted.envelope.data.farm_id);
  if (!refreshed) {
    throw new ApiError(
      "INVITE_ACCEPT_ACTIVATE_FAILED",
      "Invite accepted but activating the session failed. Please log in again.",
      500,
    );
  }

  await setSessionCookies(refreshed.accessToken, refreshed.refreshCookie, refreshed.user, accepted.envelope.data.farm_id);
  return { user: refreshed.user, farmId: accepted.envelope.data.farm_id };
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
  // rk_farm (30-day) outlives rk_at (~15min) — a stale session that comes back after the access
  // token cookie has already aged out must still be able to refresh, so farmId can't depend on
  // decoding rk_at. Fall back to it only for cookies set before rk_farm existed.
  const farmId =
    store.get(COOKIE_FARM)?.value ??
    (() => {
      const cachedAccess = store.get(COOKIE_ACCESS)?.value;
      return cachedAccess ? decodeAccessToken(cachedAccess)?.farmId : undefined;
    })();
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
  await setSessionCookies(result.accessToken, result.refreshCookie, user, farmId);

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
      // See lib/auth/refresh-core.ts's comment: the CSRF session identifier binds to whichever
      // `rakhal_refresh` cookie (if any) is present on the /auth/csrf request, so it must match
      // the one sent below or the backend 403s with "invalid csrf token".
      const csrfRes = await fetch(`${serverEnv.API_BASE_URL}/auth/csrf`, {
        cache: "no-store",
        headers: { Cookie: `rakhal_refresh=${refreshCookieValue}` },
      });
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
      // See lib/auth/refresh-core.ts's comment: the CSRF session identifier binds to whichever
      // `rakhal_refresh` cookie (if any) is present on the /auth/csrf request, so it must match
      // the one sent below or the backend 403s with "invalid csrf token".
      const csrfRes = await fetch(`${serverEnv.API_BASE_URL}/auth/csrf`, {
        cache: "no-store",
        headers: { Cookie: `rakhal_refresh=${refreshCookieValue}` },
      });
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
