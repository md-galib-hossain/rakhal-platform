"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AdminApiError, callAdminApi } from "@/lib/api/admin-api";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { buildSupportRequest, describeSupportError, type SupportActionKind } from "./support-request";
import type { ActionState } from "./support-state";

/**
 * Runs one controlled support action. Server Actions carry Next's built-in origin check; the access
 * token never leaves the server. The backend re-validates everything (reason, confirmation against the
 * real target, permission) - this layer only shapes the request and the user-facing message.
 */
export async function runSupportAction(
  kind: SupportActionKind,
  targetId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: "Your session has expired. Sign in again." };

  const request = buildSupportRequest(kind, targetId, {
    reason: formData.get("reason") ?? "",
    confirm: formData.get("confirm") ?? "",
    revokeSessions: formData.get("revokeSessions") === "on",
  });
  if (!request.ok) return { ok: false, message: null, errors: request.errors };

  try {
    await callAdminApi(request.path, { method: "POST", token, body: request.body });
  } catch (err) {
    if (err instanceof AdminApiError) return { ok: false, message: describeSupportError(err.status, err.body?.message) };
    return { ok: false, message: describeSupportError(500) };
  }

  const area = kind.startsWith("farm.") ? "farms" : "users";
  revalidatePath(`/${area}/${targetId}`);
  revalidatePath(`/${area}`);
  revalidatePath("/audit");
  return { ok: true, message: "Done. The change is recorded in the audit log." };
}
