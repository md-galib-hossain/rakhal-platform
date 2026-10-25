import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/constants/i18n";
import { serverEnv } from "@/lib/env";
import { getSession, refreshSession } from "@/lib/auth/session";
import type { ApiEnvelope } from "@/types/api";

/**
 * The single bridge every client-side fetch goes through (docs/ARCHITECTURE.md §5) — the
 * browser calls `/api/backend/<anything>` on our own origin; this forwards to the real backend
 * with the session's access token attached, and transparently refreshes-and-retries once on a
 * 401 before the browser ever sees one. A 401 that reaches the browser means the refresh itself
 * failed — the session is genuinely over.
 *
 * One catch-all route instead of a hand-written route per backend resource: the backend has
 * 225+ endpoints and grows every ticket; feature `api.ts` files just call `apiFetch('/cattle')`
 * etc. and this forwards verbatim — nothing here needs updating as new features land.
 */

async function forward(
  req: NextRequest,
  path: string[],
  body: string | ArrayBuffer | undefined,
  overrideAccessToken?: string,
): Promise<{ res: Response; accessToken: string | null }> {
  // On a retry, the caller passes the token `refreshSession()` just minted rather than letting us
  // re-read `getSession()` here: `cookies().set()` inside `refreshSession()` only touches the
  // response of whichever concurrent request actually ran the refresh — sibling requests (e.g. a
  // page firing several widget fetches at once) each hold their own request-scoped cookie
  // snapshot from before the rotation, so re-reading it would resend the same stale/expired
  // token and 401 again even though the refresh itself succeeded.
  const accessToken = overrideAccessToken ?? (await getSession())?.accessToken ?? null;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const search = req.nextUrl.search;
  const url = `${serverEnv.API_BASE_URL}/${path.join("/")}${search}`;
  // RFE-156: forward the client's `Idempotency-Key` (POST /reports) verbatim; the backend validates it.
  const idempotencyKey = req.headers.get("idempotency-key");
  const contentType = req.headers.get("content-type");
  const isMultipart = contentType?.startsWith("multipart/form-data") ?? false;

  const res = await fetch(url, {
    method: req.method,
    cache: "no-store",
    headers: {
      "Accept-Language": locale,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(body !== undefined ? { "Content-Type": isMultipart ? contentType! : "application/json" } : {}),
    },
    body,
  });
  return { res, accessToken };
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  // Read the body once up front — `req`'s body stream can only be consumed once, but a 401
  // retry below calls `forward` a second time with the same `req`; without this, the retried
  // request went out with an empty body (silently dropping the payload on POST/PATCH).
  const contentType = req.headers.get("content-type");
  const isMultipart = contentType?.startsWith("multipart/form-data") ?? false;
  const body = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : isMultipart
      ? await req.arrayBuffer()
      : await req.text();

  const first = await forward(req, path, body);
  let res = first.res;

  if (res.status === 401) {
    // Also fires when `first.accessToken` was null: rk_at's cookie maxAge matches the JWT's own
    // exp, so the browser deletes it the moment it expires — an idle SPA tab (no navigation, so
    // proxy.ts's proactive refresh never runs against this path) hits this route with no access
    // token at all, not just a stale one. refreshSession() itself no-ops if rk_rt is also gone.
    const refreshed = await refreshSession();
    if (refreshed) {
      res = (await forward(req, path, body, refreshed.accessToken)).res;
    }
  }

  let envelope: ApiEnvelope<unknown>;
  try {
    envelope = (await res.json()) as ApiEnvelope<unknown>;
  } catch {
    // The backend returned a non-JSON body — a raw crash/HTML error page, an
    // empty response, or a dropped connection (all observed during a backend
    // restart/compile window). Without this, `res.json()` throws here with no
    // catch, and Next.js shows its own generic route-handler crash page
    // instead of a real error the client can render — the exact "something
    // went wrong" symptom this was causing.
    envelope = {
      success: false,
      message: "Backend is temporarily unavailable. Please try again.",
      code: "BACKEND_UNAVAILABLE",
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(envelope, { status: 502 });
  }
  return NextResponse.json(envelope, { status: res.status });
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
