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
];

const FARM_HOSTS = new Set([
  "farm.rakhal.app",
  "localhost", // Optional: useful for local testing
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
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

function clearedRedirect(request: NextRequest, next?: string) {
  const url = new URL("/login", request.url);

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