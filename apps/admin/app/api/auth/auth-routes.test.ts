import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE, REFRESH_COOKIE, SETUP_COOKIE } from "@/lib/auth/cookie-names";
import { POST as changePassword } from "./change-password/route";
import { POST as enable2fa } from "./2fa/enable/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";

const ORIGIN = { origin: "http://admin.test", host: "admin.test", "content-type": "application/json" };

function req(path: string, body: unknown, opts: { headers?: Record<string, string>; cookie?: string } = {}) {
  return new NextRequest(`http://admin.test${path}`, {
    method: "POST",
    headers: { ...ORIGIN, ...(opts.cookie ? { cookie: opts.cookie } : {}), ...opts.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function backend(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ok = (data: unknown) => ({ success: true, data });
const fail = (message: string) => ({ success: false, message });
const cookieOf = (res: Response, name: string) =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)) ?? "";

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/auth/login", () => {
  const creds = { email: "admin@rakhal.test", password: "Sup3r-Secret-Pass", code: "123456" };

  it("rejects a cross-origin request before touching the backend", async () => {
    const f = backend(200, ok({}));
    const res = await login(req("/api/auth/login", creds, { headers: { origin: "http://evil.test" } }));
    expect(res.status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });

  it("rejects an invalid body with 400", async () => {
    const f = backend(200, ok({}));
    expect((await login(req("/api/auth/login", { email: "nope" }))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("sets httpOnly session cookies and never returns tokens in the body", async () => {
    backend(201, ok({ twoFactorSetupRequired: false, accessToken: "AT", refreshToken: "RT", sessionId: "s1" }));
    const res = await login(req("/api/auth/login", creds));
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toMatch(/AT|RT/);
    expect(cookieOf(res, ACCESS_COOKIE)).toMatch(/HttpOnly/i);
    expect(cookieOf(res, ACCESS_COOKIE)).toMatch(/SameSite=strict/i);
    expect(cookieOf(res, REFRESH_COOKIE)).toContain("RT");
  });

  it("forwards only the user agent, never a client IP header", async () => {
    const f = backend(201, ok({ twoFactorSetupRequired: false, accessToken: "AT", refreshToken: "RT" }));
    await login(req("/api/auth/login", creds, { headers: { "user-agent": "UA/1", "x-forwarded-for": "6.6.6.6" } }));
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = init.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe("UA/1");
    expect(headers["x-forwarded-for"]).toBeUndefined();
  });

  it("first sign-in: sets only the short-lived setup cookie", async () => {
    backend(201, ok({ twoFactorSetupRequired: true, setupToken: "SETUP" }));
    const res = await login(req("/api/auth/login", { ...creds, code: "" }));
    expect(((await res.json()) as { data: { status: string } }).data.status).toBe("2fa_setup_required");
    expect(cookieOf(res, SETUP_COOKIE)).toContain("SETUP");
    expect(cookieOf(res, ACCESS_COOKIE)).toMatch(/Max-Age=0/i);
  });

  it("maps backend failures to safe generic answers", async () => {
    backend(401, fail("ইমেইল অথবা পাসওয়ার্ড সঠিক নয়"));
    const bad = await login(req("/api/auth/login", creds));
    expect(bad.status).toBe(401);
    expect(((await bad.json()) as { message: string }).message).toBe("Invalid credentials");

    backend(429, fail("ThrottlerException"));
    expect((await login(req("/api/auth/login", creds))).status).toBe(429);

    backend(500, fail("stack trace with internals"));
    const down = await login(req("/api/auth/login", creds));
    expect(down.status).toBe(502);
    expect(JSON.stringify(await down.json())).not.toContain("stack trace");
  });
});

describe("POST /api/auth/2fa/enable", () => {
  it("needs the setup cookie", async () => {
    backend(201, ok({ enabled: true }));
    expect((await enable2fa(req("/api/auth/2fa/enable", { code: "123456" }))).status).toBe(401);
  });

  it("enables and clears every cookie so the admin signs in fresh", async () => {
    const f = backend(201, ok({ enabled: true }));
    const res = await enable2fa(req("/api/auth/2fa/enable", { code: "123456" }, { cookie: `${SETUP_COOKIE}=SETUP` }));
    expect(res.status).toBe(200);
    expect(cookieOf(res, SETUP_COOKIE)).toMatch(/Max-Age=0/i);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer SETUP");
  });

  it("a wrong code is a retryable 400, not a 401 that restarts the setup", async () => {
    backend(401, fail("Invalid 2FA code"));
    const res = await enable2fa(req("/api/auth/2fa/enable", { code: "123456" }, { cookie: `${SETUP_COOKIE}=SETUP` }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toMatch(/not accepted/i);
  });

  it("an expired setup token stays a 401", async () => {
    backend(401, fail("2FA setup token required"));
    const res = await enable2fa(req("/api/auth/2fa/enable", { code: "123456" }, { cookie: `${SETUP_COOKIE}=SETUP` }));
    expect(res.status).toBe(401);
  });

  it("rejects a malformed code without calling the backend", async () => {
    const f = backend(201, ok({}));
    const res = await enable2fa(req("/api/auth/2fa/enable", { code: "12" }, { cookie: `${SETUP_COOKIE}=SETUP` }));
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/change-password", () => {
  const body = { currentPassword: "Old-Password-1", newPassword: "Another-Strong-Pass-9", confirmPassword: "Another-Strong-Pass-9" };

  it("requires a session", async () => {
    backend(200, ok({}));
    expect((await changePassword(req("/api/auth/change-password", body))).status).toBe(401);
  });

  it("sends only current + new password to the backend", async () => {
    const f = backend(200, ok({ changed: true }));
    const res = await changePassword(req("/api/auth/change-password", body, { cookie: `${ACCESS_COOKIE}=AT` }));
    expect(res.status).toBe(200);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({
      currentPassword: "Old-Password-1",
      newPassword: "Another-Strong-Pass-9",
    });
  });

  it("reports a wrong current password as 400, not as signed-out", async () => {
    backend(401, fail("Current password is incorrect"));
    const res = await changePassword(req("/api/auth/change-password", body, { cookie: `${ACCESS_COOKIE}=AT` }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Current password is incorrect");
  });

  it("passes the backend policy message through on 400", async () => {
    backend(400, fail("Password must contain a digit"));
    const res = await changePassword(req("/api/auth/change-password", body, { cookie: `${ACCESS_COOKIE}=AT` }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain("digit");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears cookies even if the backend call fails", async () => {
    backend(500, fail("boom"));
    const res = await logout(req("/api/auth/logout", undefined, { cookie: `${ACCESS_COOKIE}=AT` }));
    expect(res.status).toBe(200);
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SETUP_COOKIE]) {
      expect(cookieOf(res, name)).toMatch(/Max-Age=0/i);
    }
  });

  it("rejects cross-origin logout (no forced sign-out by a third-party page)", async () => {
    const f = backend(200, ok({}));
    const res = await logout(req("/api/auth/logout", undefined, { headers: { origin: "http://evil.test" } }));
    expect(res.status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
});
