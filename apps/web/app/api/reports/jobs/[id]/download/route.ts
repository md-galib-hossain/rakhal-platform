import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getSession, refreshSession } from "@/lib/auth/session";

/**
 * Bespoke report-download route (RFE-041), same shape as the billing receipt route
 * (`app/api/billing/invoices/[id]/receipt/route.ts`). The generic `/api/backend/[...path]` proxy
 * always does `res.json()` — it would corrupt the raw CSV/PDF bytes `GET /reports/jobs/:id/download`
 * streams back. Farm/RBAC scoping happens entirely on the backend (`reports.read`,
 * `ReportsService.download` scopes by `farmId`) — this route only carries the bearer token.
 */
async function forwardDownload(id: string, accessToken: string): Promise<Response> {
  return fetch(`${serverEnv.API_BASE_URL}/reports/jobs/${id}/download`, {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, code: "NO_SESSION", message: "Not authenticated." }, { status: 401 });
  }

  let res = await forwardDownload(id, session.accessToken);

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await forwardDownload(id, refreshed.accessToken);
    }
  }

  if (!res.ok) {
    // Non-file error path (404/400/410/etc.) — the backend still returns its normal JSON envelope here.
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="report-${id}"`,
    },
  });
}
