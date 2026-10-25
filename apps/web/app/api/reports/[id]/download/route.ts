import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getSession, refreshSession } from "@/lib/auth/session";

/**
 * Bespoke report-PDF route (RFE-156). The generic `/api/backend/[...path]` proxy always runs `res.json()` on the
 * backend body, which would corrupt the binary PDF `GET /reports/:id/download` returns. Same pattern as the
 * billing receipt route: bearer token attached server-side, one refresh-and-retry on 401, bytes streamed
 * through. Authorization (`reports.read`, farm scoping, finance visibility) is entirely the backend's; the token
 * never leaves the server. Backend errors (404 / 403 / 409 `REPORT_PDF_NOT_AVAILABLE` / 503) keep their JSON
 * envelope so the client's `unwrapEnvelope` raises the same typed `ReportApiError`.
 */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

function forward(id: string, accessToken: string): Promise<Response> {
  return fetch(`${serverEnv.API_BASE_URL}/reports/${encodeURIComponent(id)}/download`, {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

const errorBody = (status: number, code: string, message: string) =>
  NextResponse.json(
    { success: false, code, message, requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
    { status },
  );

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID_SHAPE.test(id)) return errorBody(404, "NOT_FOUND", "Report not found.");

  const session = await getSession();
  if (!session) return errorBody(401, "NO_SESSION", "Not authenticated.");

  let res: Response;
  try {
    res = await forward(id, session.accessToken);
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await forward(id, refreshed.accessToken);
    }
  } catch {
    return errorBody(502, "BACKEND_UNAVAILABLE", "Backend is temporarily unavailable. Please try again.");
  }

  if (!res.ok) {
    const text = await res.text();
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    if (isJson) {
      return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
    }
    return errorBody(res.status >= 500 ? 502 : res.status, "BACKEND_ERROR", "The report could not be downloaded.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="report-${id}.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const length = res.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  return new NextResponse(res.body, { status: 200, headers });
}
