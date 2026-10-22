"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AdminApiError, callAdminApi } from "@/lib/api/admin-api";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import {
  buildPlanFeature,
  buildPlanUpdate,
  buildSubscriptionAction,
  type SubscriptionActionKind,
} from "./commercial-request";
import type { OpsRequest } from "./ops-request";
import { describeSupportError } from "./support-request";
import type { ActionState } from "./support-state";

/** Runs a validated commercial request with the session token; the backend re-validates everything. */
async function submit(request: OpsRequest, paths: string[], done: string): Promise<ActionState> {
  if (!request.ok) return { ok: false, message: null, errors: request.errors };
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: "Your session has expired. Sign in again." };
  try {
    await callAdminApi(request.path, { method: request.method, token, body: request.body });
  } catch (err) {
    if (err instanceof AdminApiError) return { ok: false, message: describeSupportError(err.status, err.body?.message) };
    return { ok: false, message: describeSupportError(500) };
  }
  for (const path of [...paths, "/audit", "/analytics"]) revalidatePath(path);
  return { ok: true, message: done };
}

const field = (formData: FormData, name: string) => formData.get(name) ?? "";

export async function subscriptionAction(
  kind: SubscriptionActionKind,
  farmId: string,
  _prev: ActionState,
  formData: FormData,
) {
  const request = buildSubscriptionAction(kind, farmId, {
    reason: field(formData, "reason"),
    confirm: field(formData, "confirm"),
    planId: field(formData, "planId"),
    period: field(formData, "period"),
    days: field(formData, "days"),
  });
  return submit(request, [`/farms/${farmId}`, "/farms"], "Done. The change is recorded in the audit log.");
}

export async function updatePlanAction(planId: string, _prev: ActionState, formData: FormData) {
  const request = buildPlanUpdate(planId, {
    reason: field(formData, "reason"),
    description: field(formData, "description"),
    monthlyPrice: field(formData, "monthlyPrice"),
    yearlyPrice: field(formData, "yearlyPrice"),
    maxCattle: field(formData, "maxCattle"),
    maxFarmMembers: field(formData, "maxFarmMembers"),
  });
  return submit(request, ["/plans"], "Plan updated for every farm on it. Recorded in the audit log.");
}

export async function togglePlanFeatureAction(
  planId: string,
  featureKey: string,
  enabled: boolean,
  _prev: ActionState,
  formData: FormData,
) {
  const request = buildPlanFeature(planId, featureKey, enabled, {
    reason: field(formData, "reason"),
    confirm: field(formData, "confirm"),
  });
  return submit(request, ["/plans"], `Feature ${enabled ? "enabled" : "disabled"} for this plan. Recorded in the audit log.`);
}
