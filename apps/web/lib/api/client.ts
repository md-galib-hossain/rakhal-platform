"use client"; // browser-side fetcher — the only place feature api.ts files call fetch from a client context

import { unwrapEnvelope } from "./envelope";
import { NetworkError } from "./errors";
import type { ApiEnvelope, CursorMeta, CursorPage } from "@/types/api";

/**
 * Every browser-originated request goes through our own `/api/backend/[...path]` proxy
 * (docs/ARCHITECTURE.md §5) — the browser never talks to the NestJS backend directly, never
 * sees a token. The proxy route handler attaches `Authorization`/`Accept-Language` server-side
 * and transparently refreshes on a 401 before the browser ever sees one (see that route's
 * comments) — a 401 that reaches here means the session is genuinely dead.
 */

export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiFetchInit {
  method?: ApiMethod;
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, searchParams?: ApiFetchInit["searchParams"]): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!searchParams) return `/api/backend${cleanPath}`;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const query = qs.toString();
  return `/api/backend${cleanPath}${query ? `?${query}` : ""}`;
}

async function rawFetch<T>(path: string, init: ApiFetchInit): Promise<{ envelope: ApiEnvelope<T>; status: number }> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, init.searchParams), {
      method: init.method ?? "GET",
      credentials: "same-origin",
      signal: init.signal,
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
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

/** For single-resource / mutation endpoints — returns the unwrapped `data`. */
export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { envelope, status } = await rawFetch<T>(path, init);
  return unwrapEnvelope(envelope, status);
}

/** For cursor-paginated list endpoints — returns `data` + the real `meta` (see types/api.ts). */
export async function apiFetchPage<T>(path: string, init: ApiFetchInit = {}): Promise<CursorPage<T>> {
  const { envelope, status } = await rawFetch<T[]>(path, init);
  const items = unwrapEnvelope(envelope, status);
  const meta = (envelope as { meta?: CursorMeta }).meta;
  if (!meta) {
    throw new Error(`Expected cursor pagination meta on ${path} — got none. Is this really a list endpoint?`);
  }
  return { items, meta };
}

/**
 * For multipart file uploads (cattle photo, CSV import). Never set a `Content-Type` header
 * manually — the browser generates the multipart boundary itself when given a `FormData` body.
 * Goes through the same `/api/backend` proxy as `apiFetch`; the proxy forwards the raw bytes +
 * original boundary-bearing header untouched (see that route's comments).
 */
export async function apiUpload<T>(path: string, file: File, fieldName = "file"): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);
  let res: Response;
  try {
    res = await fetch(buildUrl(path), { method: "POST", credentials: "same-origin", body: formData });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch (cause) {
    throw new NetworkError(cause);
  }
  return unwrapEnvelope(envelope, res.status);
}
