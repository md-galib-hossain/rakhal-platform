import { AdminApiError, adminFetch } from "@rakhal/admin-api-client";
import { env } from "@/lib/env";

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Rotating refresh tokens are single-use: replaying one revokes the whole session on the backend.
 * Several parallel requests can reach the proxy with the same expired access token, so concurrent
 * refreshes for one refresh token share a single in-flight call instead of each spending the token.
 */
const inFlight = new Map<string, Promise<RefreshedTokens | null>>();

async function callRefresh(refreshToken: string): Promise<RefreshedTokens | null> {
  try {
    const { data } = await adminFetch<RefreshedTokens>(env.ADMIN_API_BASE_URL, "/admin/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  } catch (err) {
    if (err instanceof AdminApiError && err.status >= 400 && err.status < 500) return null;
    throw err;
  }
}

/** Returns new tokens, or null when the refresh token is no longer valid (revoked, reused, expired). */
export function refreshSession(refreshToken: string): Promise<RefreshedTokens | null> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;
  const promise = callRefresh(refreshToken).finally(() => {
    // Keep the settled result briefly so a request that lands just after still reuses it.
    setTimeout(() => inFlight.delete(refreshToken), 10_000).unref?.();
  });
  inFlight.set(refreshToken, promise);
  return promise;
}
