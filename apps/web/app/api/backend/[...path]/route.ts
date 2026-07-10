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

async function forward(req: NextRequest, path: string[]): Promise<{ res: Response; accessToken: string | null }> {
  const session = await getSession();
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const search = req.nextUrl.search;
  const url = `${serverEnv.API_BASE_URL}/${path.join("/")}${search}`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

  const res = await fetch(url, {
    method: req.method,
    cache: "no-store",
    headers: {
      "Accept-Language": locale,
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
  return { res, accessToken: session?.accessToken ?? null };
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  const first = await forward(req, path);
  let res = first.res;

  if (res.status === 401 && first.accessToken) {
    // Only worth retrying if we actually had a token to begin with — an anonymous 401
    // (no session at all) means the caller should never have reached here.
    const refreshed = await refreshSession();
    if (refreshed) {
      res = (await forward(req, path)).res;
    }
  }

  const envelope = (await res.json()) as ApiEnvelope<unknown>;
  return NextResponse.json(envelope, { status: res.status });
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
