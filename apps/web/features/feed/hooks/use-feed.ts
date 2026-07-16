"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { feedApi } from "../api";
import type { CreateFeedConcentrationPayload, NormalizeConcentrationPayload } from "../types";

const STALE_TIME = 60_000;

export function useFeedIngredients() {
  return useQuery({
    queryKey: qk.feed.ingredients(),
    queryFn: () => feedApi.listIngredients(),
    staleTime: STALE_TIME,
  });
}

export function useFeedGroups() {
  return useQuery({
    queryKey: qk.feed.feedGroups(),
    queryFn: () => feedApi.listFeedGroups(),
    staleTime: STALE_TIME,
  });
}

export function useConcentrations() {
  return useQuery({
    queryKey: qk.feed.concentrations(),
    queryFn: () => feedApi.listConcentrations(),
    staleTime: STALE_TIME,
  });
}

export function useConcentrationDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.feed.concentrationDetail(id ?? ""),
    queryFn: () => feedApi.getConcentration(id as string),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

/** Live "Estimated Daily Requirements of Cow Group" box (Figma `1065:35244`) — refetches whenever
 * Step 1's Avg. Weight/Avg. Milk Target change. */
export function useFeedRequirements(weightKg: number | undefined, milkTargetL: number | undefined) {
  return useQuery({
    queryKey: qk.feed.requirements(weightKg, milkTargetL),
    queryFn: () => feedApi.requirements(weightKg as number, milkTargetL as number),
    enabled: weightKg != null && weightKg > 0 && milkTargetL != null && milkTargetL >= 0,
    staleTime: STALE_TIME,
  });
}

function useInvalidateConcentrations() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["feed", "concentrations"] });
  };
}

export function useCreateConcentration() {
  const invalidate = useInvalidateConcentrations();
  return useMutation({
    mutationFn: (dto: CreateFeedConcentrationPayload) => feedApi.createConcentration(dto),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveConcentration() {
  const invalidate = useInvalidateConcentrations();
  return useMutation({
    mutationFn: (id: string) => feedApi.removeConcentration(id),
    onSuccess: () => invalidate(),
  });
}

/** "Normalize to 100%" (Figma `1065:36651`'s sibling button `1065:35996`) — scales the draft's
 * amounts so total DM meets the Step 1 requirement, does not persist anything itself. */
export function useNormalizeConcentration() {
  return useMutation({
    mutationFn: (dto: NormalizeConcentrationPayload) => feedApi.normalize(dto),
  });
}
