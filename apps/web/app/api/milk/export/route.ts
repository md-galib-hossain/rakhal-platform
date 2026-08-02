import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getSession, refreshSession } from "@/lib/auth/session";

/**
 * Bespoke milk-export route, same shape as `app/api/reports/jobs/[id]/download/route.ts` — the
 * generic `/api/backend/[...path]` proxy always does `res.json()`, which would corrupt the raw
 * `.xlsx` bytes `POST /milk/export` streams back. Farm/RBAC scoping happens entirely on the
 * backend (`milk.read`); this route only carries the bearer token + forwards the JSON body.
 */
async function forwardExport(body: string, accessToken: string): Promise<Response> {
  return fetch(`${serverEnv.API_BASE_URL}/milk/export`, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body,
  });
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, code: "NO_SESSION", message: "Not authenticated." }, { status: 401 });
  }

  let res = await forwardExport(bodyText, session.accessToken);

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await forwardExport(bodyText, refreshed.accessToken);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="milk-log.xlsx"`,
    },
  });
}
