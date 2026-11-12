"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { feedApi } from "../api";

/**
 * Farm-level requirement settings (RFE-104, backend RAKHAL-409).
 *
 * Both mutations invalidate every requirement-shaped query, not just this one: changing the
 * model moves `GET /feed/requirements`, the `/feeding` herd figure and every saved ration's
 * scored requirement, so leaving those cached would show the farmer stale numbers right after
 * they changed the thing that produces them.
 */
export function useRequirementSettings() {
  return useQuery({
    queryKey: qk.feed.requirementSettings(),
    queryFn: () => feedApi.requirementSettings(),
  });
}

function useSettingsMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.feed.requirementSettings() }),
        queryClient.invalidateQueries({ queryKey: ["feed", "requirements"] }),
        queryClient.invalidateQueries({ queryKey: ["feed", "today-requirement"] }),
        queryClient.invalidateQueries({ queryKey: ["feed", "concentrations"] }),
      ]);
    },
  });
}

export function useUpdateRequirementSettings() {
  return useSettingsMutation(({ changes, notes }: { changes: Record<string, number>; notes?: string }) =>
    feedApi.updateRequirementSettings(changes, notes),
  );
}

export function useResetRequirementSettings() {
  return useSettingsMutation(() => feedApi.resetRequirementSettings());
}
