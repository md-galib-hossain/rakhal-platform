/** Browser-side helper for the admin BFF (`/api/auth/*`). Same-origin only; cookies are httpOnly so no tokens here. */
export interface BffResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  message: string | null;
}

export async function postJson<T = unknown>(path: string, body?: unknown): Promise<BffResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => null)) as { data?: T; message?: string } | null;
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (json?.data ?? null) : null,
      message: res.ok ? null : (json?.message ?? "Request failed"),
    };
  } catch {
    return { ok: false, status: 0, data: null, message: "Network error. Check your connection and try again." };
  }
}
