"use client"; // TanStack Query hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

/** `GET /settings/follow-up-rules` row (RAKHAL-484): a code-defined rule with this farm's switch and offset. */
export interface FollowUpRule {
  ruleKey: string;
  title: string;
  trigger: string;
  kind: string;
  enabled: boolean;
  defaultOn: boolean;
  /** Effective offset in days (the default when the farm has not changed it). */
  offsetDays: number | null;
  defaultOffsetDays: number | null;
  completesOn: string[];
}

/** One entry of `PUT /settings/follow-up-rules` (`UpdateFollowUpRulesDto`): `offsetDays: null` goes back to the default. */
export interface FollowUpRuleUpdate {
  ruleKey: string;
  enabled?: boolean;
  offsetDays?: number | null;
}

const KEY = ["settings", "follow-up-rules"] as const;

export function useFollowUpRules() {
  return useQuery({ queryKey: KEY, queryFn: () => apiFetch<FollowUpRule[]>("/settings/follow-up-rules"), staleTime: 60_000 });
}

export function useUpdateFollowUpRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: FollowUpRuleUpdate[]) => apiFetch<unknown>("/settings/follow-up-rules", { method: "PUT", body: { rules } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
