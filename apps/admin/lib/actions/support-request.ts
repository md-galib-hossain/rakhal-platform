import { z } from "zod";

export type SupportActionKind =
  | "farm.suspend"
  | "farm.reactivate"
  | "user.block"
  | "user.unblock"
  | "user.send-password-reset"
  | "user.revoke-sessions";

const PATHS: Record<SupportActionKind, (id: string) => string> = {
  "farm.suspend": (id) => `/admin/farms/${id}/suspend`,
  "farm.reactivate": (id) => `/admin/farms/${id}/reactivate`,
  "user.block": (id) => `/admin/users/${id}/block`,
  "user.unblock": (id) => `/admin/users/${id}/unblock`,
  "user.send-password-reset": (id) => `/admin/users/${id}/send-password-reset`,
  "user.revoke-sessions": (id) => `/admin/users/${id}/revoke-sessions`,
};

/** Mirrors the backend DTO; the server re-validates and checks `confirm` against the real target. */
export const supportActionSchema = z.object({
  reason: z.string().trim().min(10, "Explain why, in at least 10 characters").max(500, "At most 500 characters"),
  confirm: z.string().trim().min(1, "Type the name to confirm").max(254),
  revokeSessions: z.boolean().optional(),
});

export type SupportRequest =
  | { ok: true; path: string; body: { reason: string; confirm: string; revokeSessions?: boolean } }
  | { ok: false; errors: Record<string, string> };

export function buildSupportRequest(kind: SupportActionKind, id: string, raw: unknown): SupportRequest {
  const parsed = supportActionSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, errors };
  }
  const { reason, confirm, revokeSessions } = parsed.data;
  const body: { reason: string; confirm: string; revokeSessions?: boolean } = { reason, confirm };
  // Only the password-reset action understands this flag.
  if (kind === "user.send-password-reset" && revokeSessions) body.revokeSessions = true;
  return { ok: true, path: PATHS[kind](encodeURIComponent(id)), body };
}

/** User-facing text for a failed support action; never echoes backend internals. */
export function describeSupportError(status: number, backendMessage?: string | null): string {
  if (status === 400) return backendMessage && /confirm/i.test(backendMessage)
    ? "The confirmation text does not match. Check it and try again."
    : "The request was not accepted. Check the reason and confirmation.";
  if (status === 403) return "Your role is not allowed to do this.";
  if (status === 404) return "That record no longer exists.";
  if (status === 409) return backendMessage ?? "This record cannot be changed in its current state.";
  if (status === 429) return "Too many actions in a short time. Wait a minute and try again.";
  return "Something went wrong. Nothing was changed; try again.";
}
