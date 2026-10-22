import "server-only";
import { AdminApiError, adminFetch } from "@rakhal/admin-api-client";
import { env } from "@/lib/env";

export { AdminApiError };

/** Server-side call to the admin API with an optional bearer token. Throws {@link AdminApiError} on any non-2xx. */
export async function callAdminApi<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; token?: string; userAgent?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  // Forward the browser UA for the audit trail. The client IP is deliberately NOT forwarded: a spoofable
  // X-Forwarded-For would let a caller pick the IP the backend allowlists/audits. The backend sees this server.
  if (options.userAgent) headers["user-agent"] = options.userAgent;
  const { data } = await adminFetch<T>(env.ADMIN_API_BASE_URL, path, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  return data;
}
