"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AdminApiError, callAdminApi } from "@/lib/api/admin-api";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { buildCreateFlag, buildRetryJob, buildSaveSetting, buildToggleFlag, type OpsRequest } from "./ops-request";
import { describeSupportError } from "./support-request";
import type { ActionState } from "./support-state";

/** Runs a validated ops/config request with the session token; the backend re-validates everything. */
async function submit(request: OpsRequest, area: "/system" | "/config", done: string): Promise<ActionState> {
  if (!request.ok) return { ok: false, message: null, errors: request.errors };
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: "Your session has expired. Sign in again." };
  try {
    await callAdminApi(request.path, { method: request.method, token, body: request.body });
  } catch (err) {
    if (err instanceof AdminApiError) return { ok: false, message: describeSupportError(err.status, err.body?.message) };
    return { ok: false, message: describeSupportError(500) };
  }
  revalidatePath(area);
  revalidatePath("/audit");
  return { ok: true, message: done };
}

const text = (formData: FormData, name: string) => formData.get(name) ?? "";

export async function retryJobAction(queue: string, jobId: string, _prev: ActionState, formData: FormData) {
  return submit(
    buildRetryJob(queue, jobId, { reason: text(formData, "reason"), confirm: text(formData, "confirm") }),
    "/system",
    "Job re-queued. The retry is recorded in the audit log.",
  );
}

export async function toggleFlagAction(key: string, enabled: boolean, _prev: ActionState, formData: FormData) {
  return submit(
    buildToggleFlag(key, enabled, { reason: text(formData, "reason"), confirm: text(formData, "confirm") }),
    "/config",
    `Flag turned ${enabled ? "on" : "off"}. Recorded in the audit log.`,
  );
}

export async function createFlagAction(_prev: ActionState, formData: FormData) {
  return submit(
    buildCreateFlag({ key: text(formData, "key"), description: text(formData, "description"), reason: text(formData, "reason") }),
    "/config",
    "Flag created (off by default).",
  );
}

export async function saveSettingAction(_prev: ActionState, formData: FormData) {
  return submit(
    buildSaveSetting({
      key: text(formData, "key"),
      value: text(formData, "value"),
      description: text(formData, "description"),
      reason: text(formData, "reason"),
    }),
    "/config",
    "Setting saved. Recorded in the audit log.",
  );
}
