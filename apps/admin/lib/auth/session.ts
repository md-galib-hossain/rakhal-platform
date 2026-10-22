import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { AdminApiError, callAdminApi } from "@/lib/api/admin-api";
import { ACCESS_COOKIE } from "./cookie-names";

export interface AdminSession {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  /** Role grants as the backend declares them (may include `*` and `resource.*`). UX gating only. */
  permissions: string[];
}

/**
 * The signed-in admin, or null. Deduped per request. The proxy has already refreshed an expiring
 * access token, so a 401 here means the session was revoked/expired server-side.
 */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return await callAdminApi<AdminSession>("/admin/auth/me", { token });
  } catch (err) {
    if (err instanceof AdminApiError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
});
