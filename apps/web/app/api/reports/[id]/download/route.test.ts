import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const refreshSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession(), refreshSession: () => refreshSession() }));
vi.mock("@/lib/env", () => ({ serverEnv: { API_BASE_URL: "http://api.test/api/v1" } }));

import { GET } from "./route";

const call = (id = "rep-1") => GET(new Request("http://x") as never, { params: Promise.resolve({ id }) });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  getSession.mockReset().mockResolvedValue({ accessToken: "tok" });
  refreshSession.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("GET /api/reports/:id/download", () => {
  it("streams the PDF bytes with auth and passes Content-Disposition through", async () => {
    fetchMock.mockResolvedValue(
      new Response("%PDF-1.7 bytes", {
        status: 200,
        headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="report-weekly.pdf"' },
      }),
    );
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="report-weekly.pdf"');
    expect(await res.text()).toBe("%PDF-1.7 bytes");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/reports/rep-1/download");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("keeps the 409 REPORT_PDF_NOT_AVAILABLE JSON envelope", async () => {
    const env = { success: false, code: "CONFLICT", message: "x", details: { reason: "REPORT_PDF_NOT_AVAILABLE" } };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(env), { status: 409, headers: { "content-type": "application/json" } }));
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).details.reason).toBe("REPORT_PDF_NOT_AVAILABLE");
  });

  it("passes a 404 through as JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, code: "NOT_FOUND", message: "nf" }), { status: 404, headers: { "content-type": "application/json" } }),
    );
    const res = await call();
    expect(res.status).toBe(404);
    expect((await res.json()).success).toBe(false);
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("%PDF", { status: 200 }));
    refreshSession.mockResolvedValue({ accessToken: "new" });
    const res = await call();
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
  });

  it("401 without a session and 404 for a malformed id never hit the backend", async () => {
    getSession.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    getSession.mockResolvedValue({ accessToken: "t" });
    expect((await call("../x")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a non-JSON backend failure to a JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 503, headers: { "content-type": "text/html" } }));
    const res = await call();
    expect(res.status).toBe(502);
    expect((await res.json()).success).toBe(false);
  });
});
