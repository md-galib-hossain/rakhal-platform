"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { feedApi } from "../api";
import type {
  CreateCustomIngredientPayload,
  CreateFeedConcentrationPayload,
  LogDistributionPayload,
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

/** Live "Estimated Daily Requirements of Cow Group" box (Figma `1065:35244`) — cow/group-driven mode
 * of `GET /feed/requirements`, auto-deriving weight/milk-yield from real records instead of manual
 * entry (`feed-requirements.service.ts#calcForCattle`/`calcForFeedGroup`; merged into the wizard from
 * the removed standalone calculator, user request 2026-07-18 follow-up — `create-feed-dialog.tsx` is
 * the only caller, always passing a real `cattleId`/`feedGroupId` since a Total Mixed Ration (TMR)
 * always targets one). Manual `weightKg`/`milkTargetL` stay available as the fallback the backend already uses when
 * a record is incomplete. */
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

/** Invalidates every `["feed", "concentrations", ...]` query — both the list (`qk.feed.concentrations()`)
 * and any open detail view (`qk.feed.concentrationDetail(id)`). A plain `invalidateQueries({ queryKey:
 * qk.feed.concentrations() })` only prefix-matches the list key, not `concentrationDetail`'s sibling
 * `["feed", "concentrations", "detail", id]` branch — this predicate matches both, same as the
 * previous (accidentally-broader) hardcoded `["feed", "concentrations"]` key it replaces. */
function useInvalidateConcentrations() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "concentrations",
    });
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

/** Deleting a concentration can also archive an ingredient promoted from it (`finalize()`'s
 * `sourceConcentrationId`, see `feed-concentration.service.ts#remove`) — invalidate the ingredients
 * list too, or a just-deleted "ghost" ingredient can linger in the picker's cache for up to
 * `STALE_TIME` (user report 2026-07-18). */
export function useRemoveConcentration() {
  const invalidate = useInvalidateConcentrations();
  const invalidateIngredients = useInvalidateFeedIngredients();
  return useMutation({
    mutationFn: (id: string) => feedApi.removeConcentration(id),
    onSuccess: () => {
      invalidate();
      invalidateIngredients();
    },
  });
}

/** Multi-select delete (user request 2026-07-18). Also invalidates the ingredients list — see
 * `useRemoveConcentration`'s doc comment, same promoted-ingredient-leak fix applies to bulk delete. */
export function useBulkDeleteConcentrations() {
  const invalidate = useInvalidateConcentrations();
  const invalidateIngredients = useInvalidateFeedIngredients();
  return useMutation({
    mutationFn: (ids: string[]) => feedApi.bulkDeleteConcentrations({ ids }),
    onSuccess: () => {
      invalidate();
      invalidateIngredients();
    },
  });
}

/** Finalize — a Concentrate Mixer is a virtual recipe/calculator: finalizing one only promotes/
 * refreshes a reusable ingredient, it never touches inventory (2026-07-19). A Total Mixed Ration
 * (TMR) is the real ration — finalizing one produces a `FeedStock` inventory lot only, no
 * ingredient (Phase 12.1/12.2, 2026-07-18). Invalidates the concentrations list, the ingredients
 * list (a `FeedIngredient` row may have changed), and the stock list (a TMR finalize adds a lot). */
export function useFinalizeConcentration() {
  const invalidateConcentrations = useInvalidateConcentrations();
  const invalidateIngredients = useInvalidateFeedIngredients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedApi.finalizeConcentration(id),
    onSuccess: () => {
      invalidateConcentrations();
      invalidateIngredients();
      void queryClient.invalidateQueries({ queryKey: qk.feed.stock() });
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

// ---- Feed stock + distribution (Phase 12.4, 2026-07-18) -------------------------------------

export function useFeedStock() {
  return useQuery({
    queryKey: qk.feed.stock(),
    queryFn: () => feedApi.listStock(),
    staleTime: STALE_TIME,
  });
}

/** Delete a stock lot from inventory (user request 2026-07-19 — "form inventory it can be also
 * deleted"). */
export function useArchiveFeedStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedApi.archiveStock(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.feed.stock() }),
  });
}

/** Multi-select delete (bulk-action dock, 2026-07-21). */
export function useBulkDeleteFeedStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => feedApi.bulkDeleteStock(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.feed.stock() }),
  });
}

export function useFeedStockDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.feed.stockDetail(id ?? ""),
    queryFn: () => feedApi.getStock(id as string),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

/** "Feed Today" — logs an actual feeding against a TMR's own target (group or one cow, derived
 * server-side) and, for lines naming a `stockId`, decrements that stock lot transactionally.
 * Invalidates stock (a lot's `current_stock_kg` just changed) and this target's distribution list. */
export function useLogDistribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: LogDistributionPayload) => feedApi.logDistribution(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.feed.stock() });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "distributions",
      });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "efficiency",
      });
    },
  });
}

export function useFeedDistributions(params: {
  feedGroupId?: string;
  cattleId?: string;
  concentrationId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  cursor?: string;
}) {
  return useQuery({
    queryKey: qk.feed.distributions(params),
    queryFn: () => feedApi.listDistributions(params),
    enabled: Boolean(params.feedGroupId || params.cattleId),
    staleTime: STALE_TIME,
  });
}

/** Planned-vs-actual + cost/litre for exactly one of a group or a single cow. */
export function useFeedEfficiency(params: { feedGroupId?: string; cattleId?: string; month?: string }) {
  return useQuery({
    queryKey: qk.feed.efficiency(params),
    queryFn: () => feedApi.getEfficiency(params),
    enabled: Boolean(params.feedGroupId || params.cattleId),
    staleTime: STALE_TIME,
  });
}
