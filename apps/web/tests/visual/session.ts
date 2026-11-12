import type { BrowserContext } from "@playwright/test";

/**
 * Signs a context in without a backend. `proxy.ts` and `getSession()` only DECODE the access token (no signature
 * check: "the backend is the only verifier that matters"), so an unsigned JWT with a far-future `exp` plus the
 * four httpOnly session cookies is a complete session for the app. The mock API accepts any bearer token.
 * `exp` is fixed (year 2100) so the cookie never ages out and the run does not depend on the current date.
 */
const COOKIE_NAMES = {
  access: "rk_at",
  refresh: "rk_rt",
  user: "rk_user",
  farm: "rk_farm",
} as const; // lib/auth/cookie-names.ts
const FAR_FUTURE_EXP = 4_102_444_800;

export const TEST_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "owner@demo.rakhal.test",
  name: "Demo Owner",
  isEmailVerified: true,
} as const;
export const TEST_FARM_ID = "00000000-0000-4000-8000-0000000000f1";

function unsignedJwt(claims: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.`;
}

export async function signIn(context: BrowserContext, baseURL: string) {
  const { hostname } = new URL(baseURL);
  const accessToken = unsignedJwt({
    sub: TEST_USER.id,
    sessionId: "00000000-0000-4000-8000-0000000000a1",
    farmId: TEST_FARM_ID,
    permissionsVersion: 1,
    iat: 1_767_225_600,
    exp: FAR_FUTURE_EXP,
  });
  const base = {
    domain: hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    expires: FAR_FUTURE_EXP,
  };
  await context.addCookies([
    { ...base, name: COOKIE_NAMES.access, value: accessToken },
    { ...base, name: COOKIE_NAMES.refresh, value: "mock-refresh-token" },
    { ...base, name: COOKIE_NAMES.user, value: JSON.stringify(TEST_USER) },
    { ...base, name: COOKIE_NAMES.farm, value: TEST_FARM_ID },
  ]);
}
