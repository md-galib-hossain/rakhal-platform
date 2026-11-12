"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { feedApi } from "../api";
import type { SetRequirementOverridePayload } from "../types";

const STALE_TIME = 30_000;

/** A cow's manual requirement changes every place her requirement is read: the Feeding Grid's fit, plan fit and
 * the editor preview, the DMI comparison, saved-ration balance scores and the herd total. Refresh them all. */
function useInvalidateRequirement() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      ["feed", "requirement-override"],
      ["feed", "requirements"],
      ["feed", "grid"],
      ["feed", "plans"],
      ["feed", "today-requirement"],
      ["feed", "dmi"],
      ["feed", "concentrations"],
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

/** `{ active, resolved, last }` — worker-ok (`feed.read`). */
export function useRequirementOverride(cattleId: string | undefined) {
  return useQuery({
    queryKey: qk.feed.requirementOverride(cattleId ?? ""),
    queryFn: () => feedApi.getRequirementOverride(cattleId as string),
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

/** History, newest first. Mount it only when the list is opened — the pager has no `enabled` switch. */
export function useRequirementOverrideHistory(cattleId: string) {
  return useCursorPager(
    qk.feed.requirementOverrideHistory(cattleId),
    (cursor, limit) => feedApi.listRequirementOverrides(cattleId, cursor, limit),
    { staleTime: STALE_TIME, initialPageSize: 10 },
  );
}

export function useSetRequirementOverride(cattleId: string) {
  const invalidate = useInvalidateRequirement();
  return useMutation({
    mutationFn: (dto: SetRequirementOverridePayload) => feedApi.setRequirementOverride(cattleId, dto),
    onSuccess: invalidate,
  });
}

export function useTurnOffRequirementOverride(cattleId: string) {
  const invalidate = useInvalidateRequirement();
  return useMutation({
    mutationFn: () => feedApi.turnOffRequirementOverride(cattleId),
    onSuccess: invalidate,
  });
}
