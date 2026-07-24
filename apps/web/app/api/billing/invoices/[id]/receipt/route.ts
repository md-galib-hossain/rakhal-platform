import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getSession, refreshSession } from "@/lib/auth/session";

/**
 * Bespoke receipt-download route (RFE-036). The generic `/api/backend/[...path]` proxy always does
 * `res.json()` on the backend response (see that route's comment) — it would corrupt the binary PDF
 * `GET /billing/invoices/:id/receipt` streams back (`Content-Type: application/pdf`, raw bytes, no
 * envelope). This route mirrors the proxy's auth/refresh handling but forwards the response body as
 * a byte stream instead. Farm/ownership scoping happens entirely on the backend (`subscription.read`,
 * `BillingService.getReceipt` scopes by `farmId`) — this route only carries the bearer token, it
 * performs no authorization decisions of its own.
 */
async function forwardReceipt(id: string, accessToken: string): Promise<Response> {
  return fetch(`${serverEnv.API_BASE_URL}/billing/invoices/${id}/receipt`, {
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

  let res = await forwardReceipt(id, session.accessToken);

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await forwardReceipt(id, refreshed.accessToken);
    }
  }

  if (!res.ok) {
    // Non-PDF error path (404/403/etc.) — the backend still returns its normal JSON envelope here.
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="receipt-${id}.pdf"`,
    },
  });
}
