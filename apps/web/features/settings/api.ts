"use client";

import { apiFetch } from "@/lib/api/client";
import type { InviteTeamMemberInput } from "./schemas";
import type { RoleListResult, TeamListResult } from "./types";

/** Team & Roles (`settings/team`, `settings/roles`) — RAKHAL-030/031, no bespoke cookie logic
 * needed (unlike auth/onboarding's login/create-farm), so this goes through the standard proxy. */
export const settingsApi = {
  listTeam(): Promise<TeamListResult> {
    return apiFetch<TeamListResult>("/settings/team");
  },
  listRoles(): Promise<RoleListResult> {
    return apiFetch<RoleListResult>("/settings/roles");
  },
  inviteTeamMember(input: InviteTeamMemberInput): Promise<{ invite_id: string; expires_at: string }> {
    return apiFetch("/settings/team/invite", { method: "POST", body: input });
  },
  resendInvite(id: string): Promise<{ invite_id: string; expires_at: string }> {
    return apiFetch(`/settings/team/invites/${id}/resend`, { method: "POST" });
  },
  revokeInvite(id: string): Promise<{ id: string; revoked: true }> {
    return apiFetch(`/settings/team/invites/${id}`, { method: "DELETE" });
  },
  changeMemberRole(memberId: string, role: string): Promise<{ id: string; role: string }> {
    return apiFetch(`/settings/team/${memberId}/role`, { method: "PATCH", body: { role } });
  },
  removeMember(memberId: string): Promise<{ id: string; removed: true }> {
    return apiFetch(`/settings/team/${memberId}`, { method: "DELETE" });
  },
};
