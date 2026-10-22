import { decodeJwtExp } from "./jwt";

/** Refresh slightly before expiry so a request never races the boundary. */
export const REFRESH_SKEW_S = 30;

export type AuthAction = "none" | "refresh" | "login";

/**
 * What the proxy should do for a request, given the cookies it carries.
 * - valid access token            -> none
 * - expired/missing + refresh     -> refresh
 * - nothing usable                -> login
 */
export function decideAuthAction(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  nowMs: number = Date.now(),
): AuthAction {
  const exp = decodeJwtExp(accessToken);
  if (exp !== null && exp * 1000 - REFRESH_SKEW_S * 1000 > nowMs) return "none";
  return refreshToken ? "refresh" : "login";
}
