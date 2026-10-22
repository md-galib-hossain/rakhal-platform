/** Backend success envelope: `{ success, data, meta }` (rakhal-backend, ADR-016 admin surface). */
export interface ApiMeta {
  nextCursor?: string | null;
  hasMore?: boolean;
}
export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}
export interface ApiErrorBody {
  success: false;
  code?: string;
  message: string;
  requestId?: string;
}

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.message ?? `Request failed (${status})`);
  }
  get isAuthError() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
}

/** Minimal fetch wrapper; `baseUrl` points at the admin BFF proxy or the admin API. */
export async function adminFetch<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta?: ApiMeta }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorBody | null;
  if (!res.ok || !json || json.success !== true) {
    throw new AdminApiError(res.status, json && json.success === false ? json : null);
  }
  return { data: json.data, meta: json.meta };
}
