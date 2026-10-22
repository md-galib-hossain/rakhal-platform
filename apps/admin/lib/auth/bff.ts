import { NextResponse, type NextRequest } from "next/server";
import { AdminApiError } from "@rakhal/admin-api-client";
import { isSameOrigin } from "./origin";

/** Client context forwarded to the backend for the audit trail (UA only; see admin-api.ts for why not the IP). */
export function clientContext(request: NextRequest): { userAgent?: string } {
  return { userAgent: request.headers.get("user-agent") ?? undefined };
}

export function csrfRejection(request: NextRequest): NextResponse | null {
  return isSameOrigin(request) ? null : NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

/** Maps a backend failure to a safe, generic client response (never leaks internals). */
export function errorResponse(err: unknown, fallback = "Something went wrong. Try again."): NextResponse {
  if (err instanceof AdminApiError) {
    if (err.status === 429) return NextResponse.json({ message: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
    if (err.status === 403) return NextResponse.json({ message: err.body?.message ?? "Forbidden" }, { status: 403 });
    if (err.status === 401) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    if (err.status === 400 || err.status === 409) return NextResponse.json({ message: err.body?.message ?? "Invalid request" }, { status: err.status });
  }
  return NextResponse.json({ message: fallback }, { status: 502 });
}
