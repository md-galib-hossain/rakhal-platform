import type { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE_FALLBACK_S,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_S,
  SETUP_COOKIE,
  SETUP_MAX_AGE_S,
} from "./cookie-names";
import { decodeJwtExp } from "./jwt";

const base = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Sets the access + rotated refresh cookie. The access cookie outlives the JWT so the proxy can see it expired and refresh. */
export function setSessionCookies(res: NextResponse, accessToken: string, refreshToken: string): void {
  const exp = decodeJwtExp(accessToken);
  const ttl = exp ? Math.max(exp - Math.floor(Date.now() / 1000), 0) : ACCESS_MAX_AGE_FALLBACK_S;
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...base, maxAge: Math.max(ttl, 1) + REFRESH_MAX_AGE_S });
  res.cookies.set(REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_MAX_AGE_S });
}

export function setSetupCookie(res: NextResponse, setupToken: string): void {
  res.cookies.set(SETUP_COOKIE, setupToken, { ...base, maxAge: SETUP_MAX_AGE_S });
}

/** `keepSetup`: the page gate must not wipe a pending 2FA setup just because some other page loaded sessionless. */
export function clearSessionCookies(res: NextResponse, opts: { keepSetup?: boolean } = {}): void {
  const names = opts.keepSetup ? [ACCESS_COOKIE, REFRESH_COOKIE] : [ACCESS_COOKIE, REFRESH_COOKIE, SETUP_COOKIE];
  for (const name of names) {
    res.cookies.set(name, "", { ...base, maxAge: 0 });
  }
}
