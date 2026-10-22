import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { ACCESS_COOKIE, REFRESH_COOKIE, SETUP_COOKIE } from "./cookie-names";
import { clearSessionCookies, setSessionCookies, setSetupCookie } from "./cookies";
import { decodeJwtExp } from "./jwt";
import { isSameOrigin } from "./origin";
import { decideAuthAction } from "./refresh-policy";
import { changePasswordSchema, loginSchema } from "./schemas";

/** Unsigned test JWT; the app only reads `exp`, the backend verifies signatures. */
function jwt(exp: number | undefined): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(exp === undefined ? {} : { exp })}.sig`;
}

describe("decodeJwtExp", () => {
  it("reads exp", () => expect(decodeJwtExp(jwt(1_900_000_000))).toBe(1_900_000_000));
  it.each([undefined, null, "", "abc", "a.b", "a.!!!.c", jwt(undefined)])("returns null for %s", (v) => {
    expect(decodeJwtExp(v as string | undefined)).toBeNull();
  });
});

describe("decideAuthAction", () => {
  const now = 1_000_000 * 1000;
  const fresh = jwt(1_000_000 + 600);
  const expired = jwt(1_000_000 - 10);
  const almost = jwt(1_000_000 + 10); // inside the 30s skew

  it("keeps a valid access token", () => expect(decideAuthAction(fresh, "r", now)).toBe("none"));
  it("refreshes an expired access token", () => expect(decideAuthAction(expired, "r", now)).toBe("refresh"));
  it("refreshes slightly before expiry", () => expect(decideAuthAction(almost, "r", now)).toBe("refresh"));
  it("refreshes when the access cookie is gone but the refresh token remains", () =>
    expect(decideAuthAction(undefined, "r", now)).toBe("refresh"));
  it("asks to log in when nothing usable remains", () => {
    expect(decideAuthAction(expired, undefined, now)).toBe("login");
    expect(decideAuthAction(undefined, undefined, now)).toBe("login");
  });
  it("treats a malformed access token as expired", () => expect(decideAuthAction("junk", "r", now)).toBe("refresh"));
});

describe("session cookies", () => {
  it("sets httpOnly, SameSite=Strict cookies and keeps the access cookie alive past JWT expiry", () => {
    const res = NextResponse.json({});
    const exp = Math.floor(Date.now() / 1000) + 900;
    setSessionCookies(res, jwt(exp), "refresh-token");
    const access = res.cookies.get(ACCESS_COOKIE);
    const refresh = res.cookies.get(REFRESH_COOKIE);
    expect(access?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe("strict");
    expect(refresh?.httpOnly).toBe(true);
    expect(refresh?.value).toBe("refresh-token");
    // Must outlive the 15-minute JWT, otherwise the proxy could never see it expired and refresh.
    expect(access!.maxAge!).toBeGreaterThan(900);
  });

  it("scopes the setup cookie to 10 minutes", () => {
    const res = NextResponse.json({});
    setSetupCookie(res, "setup");
    expect(res.cookies.get(SETUP_COOKIE)?.maxAge).toBe(600);
    expect(res.cookies.get(SETUP_COOKIE)?.httpOnly).toBe(true);
  });

  it("clears all three cookies", () => {
    const res = NextResponse.json({});
    clearSessionCookies(res);
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SETUP_COOKIE]) {
      expect(res.cookies.get(name)?.maxAge).toBe(0);
    }
  });
});

describe("isSameOrigin", () => {
  const req = (headers: Record<string, string>) => new Request("http://admin.test/api/auth/login", { headers });
  it("accepts a matching origin", () =>
    expect(isSameOrigin(req({ origin: "https://admin.rakhal.test", host: "admin.rakhal.test" }))).toBe(true));
  it("prefers x-forwarded-host behind a proxy", () =>
    expect(
      isSameOrigin(req({ origin: "https://admin.rakhal.test", host: "127.0.0.1:3010", "x-forwarded-host": "admin.rakhal.test" })),
    ).toBe(true));
  it("rejects a foreign or missing origin", () => {
    expect(isSameOrigin(req({ origin: "https://evil.test", host: "admin.rakhal.test" }))).toBe(false);
    expect(isSameOrigin(req({ host: "admin.rakhal.test" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "not a url", host: "admin.rakhal.test" }))).toBe(false);
  });
});

describe("schemas", () => {
  it("login: code is optional but must be 6 digits when present", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x", code: "" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x", code: "123456" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x", code: "12345" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  const base = { currentPassword: "Old-Password-1", newPassword: "Another-Strong-Pass-9", confirmPassword: "Another-Strong-Pass-9" };
  it("change password: accepts a compliant, confirmed, different password", () =>
    expect(changePasswordSchema.safeParse(base).success).toBe(true));
  it.each([
    ["too short", { newPassword: "Short1A", confirmPassword: "Short1A" }],
    ["no digit", { newPassword: "NoDigitsInHereAtAll", confirmPassword: "NoDigitsInHereAtAll" }],
    ["mismatch", { confirmPassword: "Different-Pass-12" }],
    ["same as current", { newPassword: "Old-Password-1", confirmPassword: "Old-Password-1" }],
  ])("change password: rejects %s", (_name, patch) => {
    expect(changePasswordSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});
