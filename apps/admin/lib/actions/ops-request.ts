import { z } from "zod";

/** Same key rule as the backend (`CONFIG_KEY_PATTERN`); the server re-validates. */
export const CONFIG_KEY = /^[a-z][a-z0-9_.-]{2,63}$/;

const reason = z.string().trim().min(10, "Explain why, in at least 10 characters").max(500, "At most 500 characters");

export type OpsRequest =
  | { ok: true; path: string; method: "POST" | "PATCH" | "PUT"; body: Record<string, unknown> }
  | { ok: false; errors: Record<string, string> };

function failure(error: z.ZodError): OpsRequest {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false, errors };
}

export function buildRetryJob(queue: string, jobId: string, raw: { reason?: unknown; confirm?: unknown }): OpsRequest {
  const parsed = z
    .object({ reason, confirm: z.string().trim().min(1, "Type the job id to confirm") })
    .safeParse(raw);
  if (!parsed.success) return failure(parsed.error);
  if (parsed.data.confirm !== jobId) return { ok: false, errors: { confirm: "That does not match the job id" } };
  return {
    ok: true,
    method: "POST",
    path: `/admin/ops/queues/${encodeURIComponent(queue)}/failed/${encodeURIComponent(jobId)}/retry`,
    body: { reason: parsed.data.reason },
  };
}

export function buildToggleFlag(key: string, enabled: boolean, raw: { reason?: unknown; confirm?: unknown }): OpsRequest {
  const parsed = z
    .object({ reason, confirm: z.string().trim().min(1, "Type the flag key to confirm") })
    .safeParse(raw);
  if (!parsed.success) return failure(parsed.error);
  if (parsed.data.confirm !== key) return { ok: false, errors: { confirm: "That does not match the flag key" } };
  return {
    ok: true,
    method: "PATCH",
    path: `/admin/config/flags/${encodeURIComponent(key)}`,
    body: { enabled, reason: parsed.data.reason },
  };
}

export function buildCreateFlag(raw: { key?: unknown; description?: unknown; reason?: unknown }): OpsRequest {
  const parsed = z
    .object({
      key: z.string().trim().regex(CONFIG_KEY, "Lower-case, start with a letter, 3-64 characters of a-z 0-9 _ . -"),
      description: z.string().trim().max(300, "At most 300 characters").optional(),
      reason,
    })
    .safeParse(raw);
  if (!parsed.success) return failure(parsed.error);
  const { key, description, reason: why } = parsed.data;
  return { ok: true, method: "POST", path: "/admin/config/flags", body: { key, ...(description ? { description } : {}), reason: why } };
}

export function buildSaveSetting(raw: { key?: unknown; value?: unknown; description?: unknown; reason?: unknown }): OpsRequest {
  const parsed = z
    .object({
      key: z.string().trim().regex(CONFIG_KEY, "Lower-case, start with a letter, 3-64 characters of a-z 0-9 _ . -"),
      value: z.string().trim().min(1, "Enter a value"),
      description: z.string().trim().max(300, "At most 300 characters").optional(),
      reason,
    })
    .safeParse(raw);
  if (!parsed.success) return failure(parsed.error);
  let value: unknown;
  try {
    value = JSON.parse(parsed.data.value);
  } catch {
    return { ok: false, errors: { value: 'Must be valid JSON, e.g. 5, true, "text" or {"a":1}' } };
  }
  const { key, description, reason: why } = parsed.data;
  return {
    ok: true,
    method: "PUT",
    path: `/admin/config/settings/${encodeURIComponent(key)}`,
    body: { value, ...(description ? { description } : {}), reason: why },
  };
}
