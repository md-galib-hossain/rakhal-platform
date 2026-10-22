import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookie-names";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/cookies";
import { decideAuthAction } from "@/lib/auth/refresh-policy";
import { refreshSession } from "@/lib/auth/refresh";

function toLogin(request: NextRequest, clear: boolean): NextResponse {
  const url = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  const res = NextResponse.redirect(url);
  if (clear) clearSessionCookies(res, { keepSetup: true });
  return res;
}

/**
 * Gatekeeper for every page: no usable session -> /login; expiring access token -> rotate via the
 * refresh token and hand the new cookies both to this request (so server components see them) and
 * to the browser. Authorization itself happens in the backend and in server components - this only
 * decides "signed in or not".
 */
export async function proxy(request: NextRequest) {
  // /login/* handles its own state (setup cookie, already-signed-in redirect).
  if (request.nextUrl.pathname.startsWith("/login")) return NextResponse.next();

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const action = decideAuthAction(access, refresh);

  if (action === "none") return NextResponse.next();
  if (action === "login" || !refresh) return toLogin(request, true);

  const tokens = await refreshSession(refresh).catch(() => null);
  if (!tokens) return toLogin(request, true);

  // Make the rotated cookies visible to the rest of this request, then to the browser.
  const headers = new Headers(request.headers);
  const others = request.cookies
    .getAll()
    .filter((c) => c.name !== ACCESS_COOKIE && c.name !== REFRESH_COOKIE)
    .map((c) => `${c.name}=${c.value}`);
  headers.set(
    "cookie",
    [...others, `${ACCESS_COOKIE}=${tokens.accessToken}`, `${REFRESH_COOKIE}=${tokens.refreshToken}`].join("; "),
  );
  const res = NextResponse.next({ request: { headers } });
  setSessionCookies(res, tokens.accessToken, tokens.refreshToken);
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
