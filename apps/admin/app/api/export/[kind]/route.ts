import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { env } from "@/lib/env";

const KINDS = new Set(["farms", "users", "subscriptions"]);

/**
 * CSV download proxy. The browser never sees the access token: this handler adds it server-side and streams the
 * file back. The backend owns the real rules (per-kind permission, row cap, formula-safe cells, audit entry).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  if (!KINDS.has(kind)) return NextResponse.json({ message: "Unknown export" }, { status: 404 });

  // SameSite=Strict already keeps the cookie off cross-site requests; refuse them outright as well.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Session expired. Sign in again." }, { status: 401 });

  const upstream = await fetch(`${env.ADMIN_API_BASE_URL}/admin/exports/${kind}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) return NextResponse.json({ message: "The admin API is unreachable." }, { status: 502 });
  if (upstream.status === 401) return NextResponse.json({ message: "Session expired. Sign in again." }, { status: 401 });
  if (upstream.status === 403) return NextResponse.json({ message: "Your role cannot export this." }, { status: 403 });
  if (upstream.status === 429) return NextResponse.json({ message: "Too many exports. Wait a minute." }, { status: 429 });
  if (!upstream.ok) return NextResponse.json({ message: "The export failed. Try again." }, { status: 502 });

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "content-disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="rakhal-${kind}.csv"`,
      "cache-control": "no-store",
    },
  });
}
