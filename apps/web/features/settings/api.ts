"use client";

import { apiFetch } from "@/lib/api/client";
import type { FeedGroupFormInput, InviteTeamMemberInput, ShedFormInput, UpdateFarmInput } from "./schemas";
import type {
  FarmSettings,
  FeedGroup,
  FeedGroupListResult,
  RoleListResult,
  Shed,
  ShedListResult,
  TeamListResult,
} from "./types";

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

  getFarm(): Promise<FarmSettings> {
    return apiFetch<FarmSettings>("/settings/farm");
  },
  updateFarm(input: UpdateFarmInput): Promise<FarmSettings> {
    return apiFetch<FarmSettings>("/settings/farm", { method: "PATCH", body: input });
  },
  listSheds(): Promise<ShedListResult> {
    return apiFetch<ShedListResult>("/settings/sheds");
  },
  createShed(input: ShedFormInput): Promise<Shed> {
    return apiFetch<Shed>("/settings/sheds", { method: "POST", body: toShedBody(input) });
  },
  updateShed(id: string, input: ShedFormInput): Promise<Shed> {
    return apiFetch<Shed>(`/settings/sheds/${id}`, { method: "PATCH", body: toShedBody(input) });
  },
  deleteShed(id: string): Promise<{ id: string; is_active: false }> {
    return apiFetch(`/settings/sheds/${id}`, { method: "DELETE" });
  },
  listFeedGroups(): Promise<FeedGroupListResult> {
    return apiFetch<FeedGroupListResult>("/settings/feed-groups");
  },
  createFeedGroup(input: FeedGroupFormInput): Promise<FeedGroup> {
    return apiFetch<FeedGroup>("/settings/feed-groups", { method: "POST", body: input });
  },
  updateFeedGroup(id: string, input: FeedGroupFormInput): Promise<FeedGroup> {
    return apiFetch<FeedGroup>(`/settings/feed-groups/${id}`, { method: "PATCH", body: input });
  },
  deleteFeedGroup(id: string): Promise<{ id: string; deleted: true }> {
    return apiFetch(`/settings/feed-groups/${id}`, { method: "DELETE" });
  },
};

/** Form keeps `capacity` as a string (zod input/output types must match for `zodResolver`); the DTO
 * wants an int or omission, never a string or empty string. */
function toShedBody(input: ShedFormInput) {
  return { ...input, capacity: input.capacity ? Number(input.capacity) : undefined };
}
