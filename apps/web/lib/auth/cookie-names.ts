/**
 * No Next.js imports here on purpose — shared verbatim by `lib/auth/session.ts` (uses
 * `next/headers`, Route Handler/Server Action context) and `proxy.ts` (uses `NextRequest`/
 * `NextResponse` cookies, a different API) so the two never drift on cookie names.
 */
export const COOKIE_ACCESS = "rk_at";
export const COOKIE_REFRESH = "rk_rt";
export const COOKIE_USER = "rk_user";
// Long-lived (matches rk_rt's 30-day maxAge) so farmId survives the access token's own ~15min
// cookie expiry — deriving it by decoding rk_at breaks the moment that cookie ages out on its
// own, well before the refresh token does.
export const COOKIE_FARM = "rk_farm";

export const sessionCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // mirrors the backend's own 30-day rakhal_refresh
