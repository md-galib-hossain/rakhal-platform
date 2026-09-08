"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { settingsApi } from "../api";
import type { CreateRoleInput } from "../schemas";

/**
 * Role mutations (RFE-101) — the first consumers of the RAKHAL-031 backend, which has been
 * live and uncalled since it shipped.
 *
 * All three invalidate the team list as well as the roles list: a role's `member_count` and
 * the team table's role column are two views of the same data.
 */
function useRoleMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.settings.roles() }),
        queryClient.invalidateQueries({ queryKey: qk.settings.team() }),
      ]);
    },
  });
}

export function useCreateRole() {
  return useRoleMutation((input: CreateRoleInput) => settingsApi.createRole(input));
}

export function useUpdateRolePermissions() {
  return useRoleMutation(({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) =>
    settingsApi.updateRolePermissions(roleId, permissionKeys),
  );
}

export function useDeleteRole() {
  return useRoleMutation((roleId: string) => settingsApi.deleteRole(roleId));
}
