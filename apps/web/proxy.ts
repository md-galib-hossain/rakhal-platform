import { NextResponse, type NextRequest } from "next/server";

import {
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  COOKIE_USER,
  REFRESH_COOKIE_MAX_AGE,
  sessionCookieOpts,
} from "@/lib/auth/cookie-names";
import {
  decodeAccessToken,
  isAccessTokenExpiring,
} from "@/lib/auth/jwt";
import { performBackendRefresh } from "@/lib/auth/refresh-core";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  // bKash's own browser redirect target (`BKASH_CALLBACK_URL`) — a pure passthrough to the
  // backend's real (also unguarded) finalize endpoint. Must never depend on a live session,
  // since the whole point is forwarding regardless of token state.
  "/billing/bkash/callback",
];

// Dynamic-segment public routes an exact-match list can't express — `/invite/:token` must render
// for a signed-out invitee (that's the whole point: preview + register/login inline, see
// InviteAcceptView). Checked as a prefix, not a set membership.
const PUBLIC_PATH_PREFIXES = ["/invite/"];

const FARM_ORIGIN = process.env.NEXT_PUBLIC_FARM_URL ?? "https://farm.rakhal.app";
const FARM_HOSTNAME = new URL(FARM_ORIGIN).hostname.toLowerCase();

const FARM_HOSTS = new Set([
  FARM_HOSTNAME,
  "farm.rakhal.app",
  "localhost", // Optional: useful for local testing
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getHostname(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  )
    .split(":")[0]
    .toLowerCase();
}

/**
 * Builds a URL for `pathname` on the farm app shell, preserving the request's
 * search params. Every route except the marketing root ("/") lives on
 * `farm.rakhal.app` (auth pages included — signup/login are app-domain
 * concerns per the RFE-100 marketing/app split), so any such path reached on
 * the marketing host is handed off here rather than served/redirected locally.
 */
function toFarmUrl(request: NextRequest, pathname: string) {
  const url = new URL(FARM_ORIGIN);
  url.pathname = pathname;
  url.search = request.nextUrl.search;
  return url;
}

function clearedRedirect(request: NextRequest, next?: string) {
  const url = toFarmUrl(request, "/login");

  if (next) {
    url.searchParams.set("next", next);
  }

  const response = NextResponse.redirect(url);

  response.cookies.delete(COOKIE_ACCESS);
  response.cookies.delete(COOKIE_REFRESH);
  response.cookies.delete(COOKIE_USER);

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = getHostname(request);

  /**
   * farm.rakhal.app should open the dashboard.
   *
   * This redirect happens before "/" is treated as a public landing route.
   * The redirected /dashboard request then passes through the normal auth gate.
   */
  if (FARM_HOSTS.has(hostname) && pathname === "/") {
    return NextResponse.redirect(
      new URL("/dashboard", request.url),
    );
  }

  /**
   * The marketing host only serves "/" (the landing page). Every other path —
   * /login, /register, /onboarding, /dashboard, etc. — belongs to the app
   * shell, so hand it off to farm.rakhal.app instead of resolving it (or
   * redirecting to a login page) on the marketing origin.
   */
  if (!FARM_HOSTS.has(hostname) && pathname !== "/") {
    return NextResponse.redirect(toFarmUrl(request, pathname));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken =
    request.cookies.get(COOKIE_ACCESS)?.value;

  const refreshToken =
    request.cookies.get(COOKIE_REFRESH)?.value;

  if (!refreshToken) {
    return clearedRedirect(request, pathname);
  }

  if (!isAccessTokenExpiring(accessToken)) {
    return NextResponse.next();
  }

  const farmId = accessToken
    ? decodeAccessToken(accessToken)?.farmId
    : undefined;

  if (!farmId) {
    return clearedRedirect(request, pathname);
  }

  const refreshed = await performBackendRefresh(
    refreshToken,
    farmId,
  );

  if (!refreshed) {
    return clearedRedirect(request, pathname);
  }

  const response = NextResponse.next();
  const claims = decodeAccessToken(refreshed.accessToken);

  const accessMaxAge = claims
    ? Math.max(
        claims.exp - Math.floor(Date.now() / 1000),
        0,
      )
    : 900;

  response.cookies.set(
    COOKIE_ACCESS,
    refreshed.accessToken,
    {
      ...sessionCookieOpts,
      maxAge: accessMaxAge,
    },
  );

  response.cookies.set(
    COOKIE_REFRESH,
    refreshed.refreshCookie,
    {
      ...sessionCookieOpts,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    },
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api|favicon.ico).*)",
  ],
};