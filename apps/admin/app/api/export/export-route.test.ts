import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { GET } from "./[kind]/route";

const csv = "id,name\r\n1,A\r\n";

function req(kind: string, opts: { cookie?: boolean; headers?: Record<string, string> } = {}) {
  const request = new NextRequest(`http://admin.test/api/export/${kind}`, {
    headers: { ...(opts.cookie === false ? {} : { cookie: `${ACCESS_COOKIE}=AT` }), ...opts.headers },
  });
  return GET(request, { params: Promise.resolve({ kind }) });
}

function backend(status: number, body = csv, headers: Record<string, string> = {}) {
  const f = vi.fn(async () => new Response(body, { status, headers }));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/export/[kind]", () => {
  it("rejects unknown kinds before touching the backend", async () => {
    const f = backend(200);
    expect((await req("passwords")).status).toBe(404);
    expect(f).not.toHaveBeenCalled();
  });

  it("needs a session and refuses cross-site requests", async () => {
    const f = backend(200);
    expect((await req("farms", { cookie: false })).status).toBe(401);
    expect((await req("farms", { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });

  it("adds the token server-side and passes the file through with its headers", async () => {
    const f = backend(200, csv, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="rakhal-farms-2026-10-23.csv"',
    });
    const res = await req("farms");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(csv);
    expect(res.headers.get("content-disposition")).toContain("rakhal-farms-2026-10-23.csv");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer AT");
  });

  it("maps backend refusals to safe messages", async () => {
    backend(403);
    const denied = await req("users");
    expect(denied.status).toBe(403);
    expect(((await denied.json()) as { message: string }).message).toMatch(/role cannot/);
    backend(401);
    expect((await req("users")).status).toBe(401);
    backend(500, "stack trace with internals");
    const failed = await req("users");
    expect(failed.status).toBe(502);
    expect(JSON.stringify(await failed.json())).not.toContain("stack trace");
  });

  it("reports an unreachable backend as 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));
    expect((await req("farms")).status).toBe(502);
  });
});
