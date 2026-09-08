"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  CreateRoleInput,
  FeedGroupFormInput,
  InviteTeamMemberInput,
  ServiceProviderFormInput,
  ShedFormInput,
  SupplierFormInput,
  UpdateFarmInput,
} from "./schemas";
import type {
  FarmSettings,
  FeedGroup,
  FeedGroupListResult,
  PermissionCatalogueResult,
  RoleListResult,
  RoleOption,
  ServiceProvider,
  ServiceProviderListResult,
  Shed,
  ShedListResult,
  Supplier,
  SupplierListResult,
  TeamListResult,
} from "./types";

/** Team & Roles (`settings/team`, `settings/roles`) — RAKHAL-030/031, no bespoke cookie logic
 * needed (unlike auth/onboarding's login/create-farm), so this goes through the standard proxy. */
/** The form holds the refusal target as a string (see `feedGroupFormSchema`); the API wants a
 * number. Blank stays absent rather than becoming 0 — "no target" and "target zero refusal"
 * are different instructions to a farmhand. */
function feedGroupBody(input: FeedGroupFormInput) {
  const { refusalTargetPct, ...rest } = input;
  return {
    ...rest,
    refusalTargetPct:
      refusalTargetPct === undefined || refusalTargetPct === "" ? undefined : Number(refusalTargetPct),
  };
}

export const settingsApi = {
  listTeam(): Promise<TeamListResult> {
    return apiFetch<TeamListResult>("/settings/team");
  },
  listRoles(): Promise<RoleListResult> {
    return apiFetch<RoleListResult>("/settings/roles");
  },
  /** The grantable catalogue on its own — the roles list already embeds a copy, so this is
   * only for screens that need it without the roles. */
  listPermissions(): Promise<PermissionCatalogueResult> {
    return apiFetch<PermissionCatalogueResult>("/settings/permissions");
  },
  /** Create a farm-scoped custom role. Either seed it from a system template (`base_role`)
   * or pass an explicit grant set. Owner-only (`settings.roles-manage`). */
  createRole(input: CreateRoleInput): Promise<RoleOption> {
    return apiFetch<RoleOption>("/settings/roles", { method: "POST", body: input });
  },
  /** Replaces the role's grants wholesale — this is not a merge. */
  updateRolePermissions(roleId: string, permissionKeys: string[]): Promise<RoleOption> {
    return apiFetch<RoleOption>(`/settings/roles/${roleId}/permissions`, {
      method: "PATCH",
      body: { permission_keys: permissionKeys },
    });
  },
  deleteRole(roleId: string): Promise<{ id: string; deleted: true }> {
    return apiFetch(`/settings/roles/${roleId}`, { method: "DELETE" });
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
  deleteShed(id: string): Promise<{ id: string; deleted_at: string }> {
    return apiFetch(`/settings/sheds/${id}`, { method: "DELETE" });
  },
  listFeedGroups(): Promise<FeedGroupListResult> {
    return apiFetch<FeedGroupListResult>("/settings/feed-groups");
  },
  createFeedGroup(input: FeedGroupFormInput): Promise<FeedGroup> {
    return apiFetch<FeedGroup>("/settings/feed-groups", {
      method: "POST",
      body: feedGroupBody(input),
    });
  },
  updateFeedGroup(id: string, input: FeedGroupFormInput): Promise<FeedGroup> {
    return apiFetch<FeedGroup>(`/settings/feed-groups/${id}`, {
      method: "PATCH",
      body: feedGroupBody(input),
    });
  },
  deleteFeedGroup(id: string): Promise<{ id: string; deleted: true }> {
    return apiFetch(`/settings/feed-groups/${id}`, { method: "DELETE" });
  },
  listSuppliers(): Promise<SupplierListResult> {
    return apiFetch<SupplierListResult>("/settings/suppliers");
  },
  createSupplier(input: SupplierFormInput): Promise<Supplier> {
    return apiFetch<Supplier>("/settings/suppliers", { method: "POST", body: input });
  },
  updateSupplier(id: string, input: SupplierFormInput): Promise<Supplier> {
    return apiFetch<Supplier>(`/settings/suppliers/${id}`, { method: "PATCH", body: input });
  },
  deleteSupplier(id: string): Promise<{ id: string; deleted_at: string }> {
    return apiFetch(`/settings/suppliers/${id}`, { method: "DELETE" });
  },
  listServiceProviders(): Promise<ServiceProviderListResult> {
    return apiFetch<ServiceProviderListResult>("/settings/service-providers");
  },
  createServiceProvider(input: ServiceProviderFormInput): Promise<ServiceProvider> {
    return apiFetch<ServiceProvider>("/settings/service-providers", { method: "POST", body: input });
  },
  updateServiceProvider(id: string, input: ServiceProviderFormInput): Promise<ServiceProvider> {
    return apiFetch<ServiceProvider>(`/settings/service-providers/${id}`, { method: "PATCH", body: input });
  },
  deleteServiceProvider(id: string): Promise<{ id: string; deleted_at: string }> {
    return apiFetch(`/settings/service-providers/${id}`, { method: "DELETE" });
  },
};

/** Form keeps `capacity` as a string (zod input/output types must match for `zodResolver`); the DTO
 * wants an int or omission, never a string or empty string. */
function toShedBody(input: ShedFormInput) {
  return { ...input, capacity: input.capacity ? Number(input.capacity) : undefined };
}
