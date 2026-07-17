"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { feedApi } from "../api";
import type {
  CreateCustomIngredientPayload,
  CreateFeedConcentrationPayload,
  NormalizeConcentrationPayload,
  UpdateFeedConcentrationPayload,
} from "../types";

function useInvalidateFeedIngredients() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: qk.feed.ingredients() });
}

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
 * Step 1's Avg. Weight/Avg. Milk Target change. Manual-only (the wizard has never offered a
 * cattle/group-driven mode) — see `useCattleOrGroupRequirements` for that. */
export function useFeedRequirements(weightKg: number | undefined, milkTargetL: number | undefined) {
  return useQuery({
    queryKey: qk.feed.requirements(weightKg, milkTargetL),
    queryFn: () => feedApi.requirements({ weightKg, milkTargetL }),
    enabled: weightKg != null && weightKg > 0 && milkTargetL != null && milkTargetL >= 0,
    staleTime: STALE_TIME,
  });
}

/** Standalone nutrition calculator (user request 2026-07-18) — cow/group-driven mode of the same
 * `GET /feed/requirements` route, auto-deriving weight/milk-yield from real records instead of
 * manual entry (`feed-requirements.service.ts#calcForCattle`/`calcForFeedGroup`). Manual
 * `weightKg`/`milkTargetL` fallback stays available (passed through unused by the backend unless
 * the cattle/group record is incomplete). */
export function useCattleOrGroupRequirements(params: {
  cattleId?: string;
  feedGroupId?: string;
  weightKg?: number;
  milkTargetL?: number;
}) {
  return useQuery({
    queryKey: qk.feed.requirementsFor(params),
    queryFn: () => feedApi.requirements(params),
    enabled: Boolean(params.cattleId || params.feedGroupId),
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

export function useUpdateConcentration() {
  const invalidate = useInvalidateConcentrations();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFeedConcentrationPayload }) =>
      feedApi.updateConcentration(id, dto),
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

/** Multi-select delete (user request 2026-07-18). */
export function useBulkDeleteConcentrations() {
  const invalidate = useInvalidateConcentrations();
  return useMutation({
    mutationFn: (ids: string[]) => feedApi.bulkDeleteConcentrations({ ids }),
    onSuccess: () => invalidate(),
  });
}

/** Promote a Concentrate Mixer template into a reusable ingredient + stock batch (user request
 * 2026-07-17/18) — invalidates both the concentrations list (version bump) and the ingredients list
 * (a new `FeedIngredient` row appears, so a Feed Mixture's `IngredientPicker` picks it up immediately). */
export function useFinalizeConcentration() {
  const invalidateConcentrations = useInvalidateConcentrations();
  const invalidateIngredients = useInvalidateFeedIngredients();
  return useMutation({
    mutationFn: (id: string) => feedApi.finalizeConcentration(id),
    onSuccess: () => {
      invalidateConcentrations();
      invalidateIngredients();
    },
  });
}

/** "Normalize to 100%" (Figma `1065:36651`'s sibling button `1065:35996`) — scales the draft's
 * amounts so total DM meets the Step 1 requirement, does not persist anything itself. */
export function useNormalizeConcentration() {
  return useMutation({
    mutationFn: (dto: NormalizeConcentrationPayload) => feedApi.normalize(dto),
  });
}

/** "Add Custom Ingredient" (user request 2026-07-17, no Figma frame) — a farm's own quick-add
 * ingredient, invalidates the ingredient list so it appears in the picker immediately. */
export function useCreateCustomIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCustomIngredientPayload) => feedApi.createCustomIngredient(dto),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.feed.ingredients() }),
  });
}
