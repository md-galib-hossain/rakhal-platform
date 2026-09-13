"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { feedApi } from "@/features/feed/api";
import { cattleApi } from "@/features/cattle/api";

/**
 * Feed-group membership + default-ration hooks (RFE-102).
 *
 * `GET /feed/groups/:id/cattle` and `POST /feed/groups/:id/assign-cattle` have existed since
 * Phase 4 with no frontend consumer at all — these are the first.
 *
 * Group *records* still come from `features/settings/hooks/use-workspace`, because the routes
 * remain at `/settings/feed-groups`; only the UI moved to `/feeding`.
 */
export function useGroupCattle(groupId: string) {
  return useQuery({
    queryKey: qk.feed.groupCattle(groupId),
    queryFn: () => feedApi.listGroupCattle(groupId),
    enabled: Boolean(groupId),
  });
}

export function useAssignCattleToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, cattleIds }: { groupId: string; cattleIds: string[] }) =>
      feedApi.assignCattleToGroup(groupId, cattleIds),
    onSuccess: async (_result, { groupId }) => {
      // Membership changes the group's `assigned_count` and the herd's group column, so both
      // the settings-owned group list and the cattle list are stale afterwards.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.feed.groupCattle(groupId) }),
        queryClient.invalidateQueries({ queryKey: qk.settings.feedGroups() }),
        queryClient.invalidateQueries({ queryKey: qk.cattle.feedGroups() }),
      ]);
    },
  });
}

/** Removes one cow from a feed group. `POST /feed/groups/:id/assign-cattle` only ever moves a cow
 * *into* a group (`Cattle.feedGroupId = groupId`, no null path) — there's no matching "unassign"
 * route, so this reuses Cattle's own bulk endpoint (`change_feed_group` with no `feedGroupId` in
 * the payload, which `cattle.service.ts` reads as "clear it") against a single-cow selection
 * instead (user report 2026-09-09: could add cows to a group from `AssignCattleDialog` but not
 * remove one from its current-members list). */
export function useRemoveCattleFromGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, cattleId }: { groupId: string; cattleId: string }) =>
      cattleApi.bulk([cattleId], "change_feed_group", {}),
    onSuccess: async (_result, { groupId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.feed.groupCattle(groupId) }),
        queryClient.invalidateQueries({ queryKey: qk.settings.feedGroups() }),
        queryClient.invalidateQueries({ queryKey: qk.cattle.feedGroups() }),
        queryClient.invalidateQueries({ queryKey: ["cattle", "list"] }),
      ]);
    },
  });
}

export function useSetGroupDefaultConcentration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, concentrationId }: { groupId: string; concentrationId: string | null }) =>
      feedApi.setGroupDefaultConcentration(groupId, concentrationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.feedGroups() }),
  });
}
