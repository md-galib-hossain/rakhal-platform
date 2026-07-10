import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_USER, REFRESH_COOKIE_MAX_AGE, sessionCookieOpts } from "@/lib/auth/cookie-names";
import { decodeAccessToken, isAccessTokenExpiring } from "@/lib/auth/jwt";
import { performBackendRefresh } from "@/lib/auth/refresh-core";

/**
 * Coarse auth gate + proactive token refresh (docs/ARCHITECTURE.md §5). Runs in Node.js runtime
 * by default (Next 16 — Buffer/etc. all work here, no edge-runtime constraint).
 *
 * Uses `NextRequest`/`NextResponse` cookies, NOT `next/headers`'s `cookies()` — that API only
 * works in Server Components/Actions/Route Handlers, a different surface from Proxy. This is
 * why the refresh call goes through the cookie-API-agnostic `performBackendRefresh` core shared
 * with `lib/auth/session.ts`, rather than reusing that file's `refreshSession()` directly.
 */
const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

function clearedRedirect(request: NextRequest, next?: string) {
  const url = new URL("/login", request.url);
  if (next) url.searchParams.set("next", next);
  const res = NextResponse.redirect(url);
  res.cookies.delete(COOKIE_ACCESS);
  res.cookies.delete(COOKIE_REFRESH);
  res.cookies.delete(COOKIE_USER);
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const accessToken = request.cookies.get(COOKIE_ACCESS)?.value;
  const refreshToken = request.cookies.get(COOKIE_REFRESH)?.value;

  if (!refreshToken) {
    return clearedRedirect(request, pathname);
  }
  if (!isAccessTokenExpiring(accessToken)) {
    return NextResponse.next();
  }

  const farmId = accessToken ? decodeAccessToken(accessToken)?.farmId : undefined;
  if (!farmId) return clearedRedirect(request, pathname);

  const refreshed = await performBackendRefresh(refreshToken, farmId);
  if (!refreshed) return clearedRedirect(request, pathname);

  const res = NextResponse.next();
  const claims = decodeAccessToken(refreshed.accessToken);
  const accessMaxAge = claims ? Math.max(claims.exp - Math.floor(Date.now() / 1000), 0) : 900;
  res.cookies.set(COOKIE_ACCESS, refreshed.accessToken, { ...sessionCookieOpts, maxAge: accessMaxAge });
  res.cookies.set(COOKIE_REFRESH, refreshed.refreshCookie, { ...sessionCookieOpts, maxAge: REFRESH_COOKIE_MAX_AGE });
  // rk_user is left untouched — the cached login-time profile is still valid.
  return res;
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization, and our own API routes (which
    // handle their own auth via lib/auth/session.ts + the cookie-reading proxy above them).
    "/((?!_next/static|_next/image|api|favicon.ico).*)",
  ],
};
