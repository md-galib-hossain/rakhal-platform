import "server-only";
import { cookies } from "next/headers";
import { localeCookieName, defaultLocale, isLocale } from "@/lib/constants/i18n";
import { serverEnv } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { unwrapEnvelope } from "./envelope";
import { NetworkError } from "./errors";
import type { ApiEnvelope, CursorMeta, CursorPage } from "@/types/api";
import type { ApiFetchInit } from "./client";

/**
 * Server Component / Server Action data fetching — calls the backend directly (no network hop
 * through our own `/api/backend` proxy, since we're already on the server). Attaches the
 * session's access token + the active UI locale as `Accept-Language` (verified live: the
 * backend localizes error messages off this header, defaulting to `bn`).
 *
 * Does NOT attempt a reactive refresh-on-401 here — `proxy.ts` proactively refreshes the token
 * before a request reaches page rendering, and a plain RSC render cannot write cookies anyway
 * (Next.js only allows cookie mutation in a Server Action or Route Handler). A 401 here is
 * surfaced as a normal `ApiError` for the route's `error.tsx` to handle.
 */
export async function serverFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { envelope, status } = await rawServerFetch<T>(path, init);
  return unwrapEnvelope(envelope, status);
}

export async function serverFetchPage<T>(path: string, init: ApiFetchInit = {}): Promise<CursorPage<T>> {
  const { envelope, status } = await rawServerFetch<T[]>(path, init);
  const items = unwrapEnvelope(envelope, status);
  const meta = (envelope as { meta?: CursorMeta }).meta;
  if (!meta) {
    throw new Error(`Expected cursor pagination meta on ${path} — got none. Is this really a list endpoint?`);
  }
  return { items, meta };
}

async function rawServerFetch<T>(
  path: string,
  init: ApiFetchInit,
): Promise<{ envelope: ApiEnvelope<T>; status: number }> {
  const session = await getSession();
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(init.searchParams ?? {})) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const query = qs.toString();
  const url = `${serverEnv.API_BASE_URL}${cleanPath}${query ? `?${query}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      cache: "no-store",
      signal: init.signal,
      headers: {
        "Accept-Language": locale,
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch (cause) {
    throw new NetworkError(cause);
  }
  return { envelope, status: res.status };
}
