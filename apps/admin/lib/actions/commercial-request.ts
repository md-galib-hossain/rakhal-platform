import { z } from "zod";
import type { OpsRequest } from "./ops-request";

export type SubscriptionActionKind = "activate" | "comp" | "extend" | "cancel";

const reason = z.string().trim().min(10, "Explain why, in at least 10 characters").max(500, "At most 500 characters");
const confirm = z.string().trim().min(1, "Type the farm name to confirm");
const days = z.coerce
  .number({ message: "Enter a number of days" })
  .int("Whole days only")
  .min(1, "At least 1 day")
  .max(365, "At most 365 days");

function failure(error: z.ZodError): OpsRequest {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false, errors };
}

/** Manual subscription operation on a farm; the backend re-checks `confirm` against the real farm name. */
export function buildSubscriptionAction(kind: SubscriptionActionKind, farmId: string, raw: Record<string, unknown>): OpsRequest {
  const schemas = {
    activate: z.object({
      reason,
      confirm,
      planId: z.string().trim().min(1, "Choose a plan"),
      period: z.enum(["MONTHLY", "YEARLY"], { message: "Choose a billing period" }),
    }),
    comp: z.object({ reason, confirm, planId: z.string().trim().min(1, "Choose a plan"), days }),
    extend: z.object({ reason, confirm, days }),
    cancel: z.object({ reason, confirm }),
  } as const;
  const parsed = schemas[kind].safeParse(raw);
  if (!parsed.success) return failure(parsed.error);
  return {
    ok: true,
    method: "POST",
    path: `/admin/farms/${encodeURIComponent(farmId)}/subscription/${kind}`,
    body: parsed.data as Record<string, unknown>,
  };
}

const optionalNumber = (label: string, opts: { int?: boolean; min: number }) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || Number.isFinite(v), { message: `${label} must be a number` })
    .refine((v) => v === undefined || v >= opts.min, { message: `${label} must be at least ${opts.min}` })
    .refine((v) => v === undefined || !opts.int || Number.isInteger(v), { message: `${label} must be a whole number` });

/** Plan edit: only the fields the admin filled in are sent. At least one must change. */
export function buildPlanUpdate(planId: string, raw: Record<string, unknown>): OpsRequest {
  const parsed = z
    .object({
      reason,
      description: z.string().trim().max(300, "At most 300 characters").optional(),
      monthlyPrice: optionalNumber("Monthly price", { min: 0 }),
      yearlyPrice: optionalNumber("Yearly price", { min: 0 }),
      maxCattle: optionalNumber("Max cattle", { min: 0, int: true }),
      maxFarmMembers: optionalNumber("Max members", { min: 1, int: true }),
    })
    .safeParse(raw);
  if (!parsed.success) return failure(parsed.error);
  const { reason: why, description, ...numbers } = parsed.data;
  const body: Record<string, unknown> = { reason: why };
  if (description) body.description = description;
  for (const [key, value] of Object.entries(numbers)) if (value !== undefined) body[key] = value;
  if (Object.keys(body).length === 1) {
    return { ok: false, errors: { form: "Change at least one field" } };
  }
  return { ok: true, method: "PATCH", path: `/admin/plans/${encodeURIComponent(planId)}`, body };
}

export function buildPlanFeature(
  planId: string,
  featureKey: string,
  enabled: boolean,
  raw: { reason?: unknown; confirm?: unknown },
): OpsRequest {
  const parsed = z.object({ reason, confirm: z.string().trim().min(1, "Type the feature key to confirm") }).safeParse(raw);
  if (!parsed.success) return failure(parsed.error);
  if (parsed.data.confirm !== featureKey) return { ok: false, errors: { confirm: "That does not match the feature key" } };
  return {
    ok: true,
    method: "PUT",
    path: `/admin/plans/${encodeURIComponent(planId)}/features/${encodeURIComponent(featureKey)}`,
    body: { enabled, reason: parsed.data.reason },
  };
}
