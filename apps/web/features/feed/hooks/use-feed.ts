"use client";

import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { inventoryApi } from "@/features/inventory/api";
import { feedApi } from "../api";
import type {
  ConfirmFeedGridPayload,
  CreateCustomIngredientPayload,
  IngredientListFilters,
  SetFeedOverridePayload,
  UpdateCustomIngredientPayload,
  CreateFeedConcentrationPayload,
  FinalizeConcentrationPayload,
  LogDistributionPayload,
  NormalizeConcentrationPayload,
  PatchRefusalPayload,
  SaveFeedGridDraftPayload,
  UpdateFeedConcentrationPayload,
  VoidFeedCattleItemPayload,
} from "../types";

/** Invalidates both the plain unpaginated ingredients list (`qk.feed.ingredients()`, used by pickers)
 * and every paged/filtered variant (`["feed", "ingredients", "paged", ...]`, used by the management
 * table) — a plain `invalidateQueries({ queryKey: qk.feed.ingredients() })` only prefix-matches the
 * former, not the paged branch's own key shape. */
function useInvalidateFeedIngredients() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.feed.ingredients() });
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "ingredients",
    });
  };
}

const STALE_TIME = 60_000;

export function useFeedIngredients() {
  return useQuery({
    queryKey: qk.feed.ingredients(),
    queryFn: () => feedApi.listIngredients(),
    staleTime: STALE_TIME,
  });
}

/** Cursor-paginated + filterable ingredients list for the Ingredients management table
 * (2026-08-14, user request) — mirrors Inventory's `useFeedItemPagedList`. `useFeedIngredients()`
 * above stays the plain unpaginated array pickers/dialogs need for full-catalogue selection. */
export function useIngredientPagedList(filters: IngredientListFilters) {
  return useCursorPager(
    qk.feed.ingredientsPaged({ ...filters, feedClass: filters.feedClass?.join(",") }),
    (cursor, limit) => feedApi.listIngredientsPaged(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

export function useFeedGroups() {
  return useQuery({
    queryKey: qk.feed.feedGroups(),
    queryFn: () => feedApi.listFeedGroups(),
    staleTime: STALE_TIME,
  });
}

export function useSetGroupDefaultConcentration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, concentrationId }: { groupId: string; concentrationId: string | null }) =>
      feedApi.setGroupDefaultConcentration(groupId, concentrationId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.feed.feedGroups() }),
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
export interface RequirementParams {
  cattleId?: string;
  feedGroupId?: string;
  weightKg?: number;
  milkTargetL?: number;
  milkFatPct?: number;
  milkProteinPct?: number;
  gestationDays?: number;
  bcs?: number;
  dim?: number;
  animalType?: "COW" | "HEIFER" | "DRY";
}

/**
 * Cow requirements in any of the three modes the backend has always supported (RFE-103).
 *
 * The old `enabled: Boolean(cattleId || feedGroupId)` guard made a cow or group mandatory, so
 * manual entry could never reach the endpoint even though `calcManual` has been there since
 * RAKHAL-081. Now a request goes out whenever the inputs are sufficient for *some* mode:
 * a cow, a group, or a weight plus a milk target.
 */
export function useRequirements(params: RequirementParams) {
  const manualReady = params.weightKg != null && params.milkTargetL != null;
  return useQuery({
    queryKey: qk.feed.requirementsFor(params),
    queryFn: () => feedApi.requirements(params),
    enabled: Boolean(params.cattleId || params.feedGroupId || manualReady),
    staleTime: STALE_TIME,
  });
}

/** @deprecated Use {@link useRequirements}. Kept so `create-feed-dialog.tsx` (RAKHAL-263's
 * lane) does not have to change in this ticket. */
export const useCattleOrGroupRequirements = useRequirements;

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

/** Finalize — **superseded 2026-09-13 (RAKHAL-421, MILESTONE 8c)**: a Concentrate Mixer finalize
 * used to be purely a virtual recipe/calculator that never touched inventory (2026-07-19 stance,
 * now false); it now *also* produces a `FeedStock` lot exactly like a Total Mixed Ration does,
 * unified onto one table (`kind: 'CONCENTRATE_TEMPLATE' | 'FEED_MIXTURE'`) — see
 * `docs/EPIC_PREPARED_FEED.md`. Both kinds still promote/refresh a reusable `FeedIngredient`
 * (Concentrate only) and both now add a stock lot, so this hook invalidates the concentrations
 * list, the ingredients list, and the stock list on every finalize, not just a TMR's. */
export function useFinalizeConcentration() {
  const invalidateConcentrations = useInvalidateConcentrations();
  const invalidateIngredients = useInvalidateFeedIngredients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto?: FinalizeConcentrationPayload }) =>
      feedApi.finalizeConcentration(id, dto),
    onSuccess: () => {
      invalidateConcentrations();
      invalidateIngredients();
      void queryClient.invalidateQueries({ queryKey: qk.feed.stock() });
      // A FEED_MIXTURE finalize may have just paid for the batch out of the farm wallet —
      // refresh the wallet balance/history so it isn't stale. No-op cost for a
      // CONCENTRATE_TEMPLATE finalize (nothing paid, cache just re-fetches unchanged data).
      void queryClient.invalidateQueries({ queryKey: qk.finance.wallet() });
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

export function useUpdateCustomIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCustomIngredientPayload }) =>
      feedApi.updateCustomIngredient(id, dto),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.feed.ingredients() }),
  });
}

export function useDeleteCustomIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedApi.deleteCustomIngredient(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.feed.ingredients() }),
  });
}

export function useSetIngredientOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SetFeedOverridePayload }) =>
      feedApi.setIngredientOverride(id, dto),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.feed.ingredients() }),
  });
}

export function useResetIngredientOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedApi.resetIngredientOverride(id),
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

// ---- Feeding-system upgrade (2026-08-13, user request) -------------------------------------

/** Layered targeting resolution — which active ration this cow is actually on right now. */
export function useResolvedRation(cattleId: string | undefined) {
  return useQuery({
    queryKey: qk.feed.resolvedRation(cattleId ?? ""),
    queryFn: () => feedApi.getResolvedRation(cattleId as string),
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

export function useDmi(cattleId: string | undefined, date?: string) {
  return useQuery({
    queryKey: qk.feed.dmi(cattleId ?? "", date),
    queryFn: () => feedApi.getDmi(cattleId as string, date),
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

export function useTodaysRequirement() {
  return useQuery({
    queryKey: qk.feed.todaysRequirement(),
    queryFn: () => feedApi.getTodaysRequirement(),
    staleTime: STALE_TIME,
  });
}

/** Feeding Grid (2026-08-15) — per-day, per-cow grid replacing the single-item Quick Feed dialog. */
export function useFeedGrid(date: string, feedGroupId?: string) {
  return useQuery({
    queryKey: qk.feed.grid(date, feedGroupId),
    queryFn: () => feedApi.getFeedGrid({ date, feedGroupId }),
    staleTime: STALE_TIME,
  });
}

/** RAKHAL-434/RFE-118 — per-day entry status for the missed-entry calendar picker. `month` is
 * `YYYY-MM`. */
export function useFeedGridCalendar(month: string) {
  return useQuery({
    queryKey: qk.feed.gridCalendar(month),
    queryFn: () => feedApi.getFeedGridCalendar(month),
    staleTime: STALE_TIME,
  });
}

/** Saves the grid's staged per-cow quantities against one source item — no inventory effect.
 * Invalidates just this date+group's grid query. */
export function useSaveFeedDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SaveFeedGridDraftPayload) => feedApi.saveFeedGridDraft(dto),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: qk.feed.grid(variables.date, variables.feedGroupId) });
    },
  });
}

/** Confirms the grid's staged (or freshly entered) per-cow quantities — decrements inventory, this
 * is the "feeding actually happened" step. Invalidates the grid itself plus stock/distribution/
 * efficiency/today's-requirement, same set `useLogDistribution` does. */
export function useConfirmFeedDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ConfirmFeedGridPayload) => feedApi.confirmFeedGrid(dto),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: qk.feed.grid(variables.date, variables.feedGroupId) });
      void queryClient.invalidateQueries({ queryKey: qk.feed.stock() });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "distributions",
      });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "efficiency",
      });
      void queryClient.invalidateQueries({ queryKey: qk.feed.todaysRequirement() });
      // A confirm can touch any cow's own per-cow history trail (the panel opened from a Feeding
      // Grid row) for this same date — same broad invalidation `useVoidFeedCattleItem` uses, since
      // this mutation doesn't know which cattle-history panel (if any) is currently open.
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "feed" &&
          query.queryKey[1] === "grid" &&
          query.queryKey[2] === "cattle-history" &&
          query.queryKey[4] === variables.date,
      });
    },
  });
}

/** RAKHAL-441 frontend twin — the Grid UI's session picker options. */
export function useFeedActiveSessions() {
  return useQuery({
    queryKey: qk.feed.activeSessions(),
    queryFn: () => feedApi.getActiveSessions(),
    staleTime: STALE_TIME,
  });
}

/** RAKHAL-441 frontend twin (per-cow) — one cow's own feeding entries for one exact day (server
 * defaults to today when omitted, incl. voided ones), backing the per-cow History panel opened
 * from that cow's own Feeding Grid row. */
export function useFeedCattleHistory(cattleId: string | undefined, date?: string) {
  return useQuery({
    queryKey: qk.feed.cattleHistory(cattleId ?? "", date),
    queryFn: () => feedApi.getFeedCattleHistory(cattleId as string, date),
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

/** Void one cow's confirmed line — invalidates the grid, that cow's own history trail, stock,
 * distributions, and cattle finance (feed cost just changed for that cow), same invalidation set
 * `useConfirmFeedDraft` uses since a void is the same kind of inventory-affecting correction. */
export function useVoidFeedCattleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      distributionId: string;
      cattleItemId: string;
      cattleId: string;
      dto: VoidFeedCattleItemPayload;
    }) => feedApi.voidFeedCattleItem(vars.distributionId, vars.cattleItemId, vars.dto),
    onSuccess: (_data, variables) => {
      // Broad predicate, not an exact-key match against one date/group — the caller (a per-cow
      // history panel) doesn't know which date/group the Feeding Grid underneath is currently
      // showing, so every cached grid page is invalidated rather than risking a stale miss.
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "feed" &&
          query.queryKey[1] === "grid" &&
          query.queryKey[2] !== "cattle-history" &&
          query.queryKey[2] !== "calendar",
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "feed" &&
          query.queryKey[1] === "grid" &&
          query.queryKey[2] === "cattle-history" &&
          query.queryKey[3] === variables.cattleId,
      });
      void queryClient.invalidateQueries({ queryKey: qk.feed.stock() });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "distributions",
      });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "cattle" && query.queryKey[1] === "finance",
      });
    },
  });
}

export function usePatchRefusal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ distributionId, dto }: { distributionId: string; dto: PatchRefusalPayload }) =>
      feedApi.patchRefusal(distributionId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "distributions",
      });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === "refusal-trend",
      });
    },
  });
}

export function useRefusalTrend(feedGroupId: string | undefined, days?: number) {
  return useQuery({
    queryKey: qk.feed.refusalTrend(feedGroupId ?? ""),
    queryFn: () => feedApi.getRefusalTrend(feedGroupId as string, days),
    enabled: Boolean(feedGroupId),
    staleTime: STALE_TIME,
  });
}

/** Explicit-checkpoint versioning, `FEED_MIXTURE` only — "Save as Template". */
export function useSaveVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ concentrationId, name }: { concentrationId: string; name?: string }) =>
      feedApi.saveVersion(concentrationId, name),
    onSuccess: (_data, { concentrationId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.feed.versions(concentrationId) });
      void queryClient.invalidateQueries({ queryKey: qk.feed.concentrationDetail(concentrationId) });
    },
  });
}

export function useVersions(concentrationId: string | undefined) {
  return useQuery({
    queryKey: qk.feed.versions(concentrationId ?? ""),
    queryFn: () => feedApi.listVersions(concentrationId as string),
    enabled: Boolean(concentrationId),
    staleTime: STALE_TIME,
  });
}

/** Farm-wide feed cost/cow/day + cost/litre, for the Dashboard widget. */
export function useFeedCostSummary(days?: number) {
  return useQuery({
    queryKey: qk.feed.costSummary(),
    queryFn: () => feedApi.getCostSummary(days),
    staleTime: STALE_TIME,
  });
}

/**
 * RFE-113 (2026-09-14) — client-side preview of what `POST /feed/concentrations/:id/finalize` will
 * actually do, mirroring `resolveBatchDeductions`'s own split+shortfall logic (backend, MILESTONE
 * 8c) closely enough to be genuinely useful, while the backend stays the only authoritative gate —
 * a race between this preview and the real finalize call still surfaces via the mutation's own
 * error, same `err.message` pattern every dialog in this app already uses.
 *
 * **Unlinked cost is exact, not estimated** — an unlinked line's price is the catalogue rate
 * already shown in `cost_tk` on the detail response, the same number `resolveBatchDeductions` sums
 * for `unlinkedCostTk`.
 *
 * **Linked-line shortfall is exact for a `FeedStock` link** (its `current_stock_kg` is already kg,
 * no conversion) and **exact for a `FeedItem` link only when `kgPerUnit` is set** — when it isn't,
 * this can't compute a kg comparison any more than the picker could compute a precise `FeedStock`
 * match (see `BatchLinkPicker`'s doc comment for the sibling gap); that line is surfaced as
 * "unchecked", not silently passed or wrongly failed.
 *
 * Fan-out pattern (one un-paginated `useFeedStock()` + one `useFeedItemDetail`-shaped call per
 * distinct linked `FeedItem` id via `useQueries`) matches `use-finance-v2.ts`'s own documented
 * precedent for "no bulk-by-ids route exists, so fetch each one" — same justification applies here.
 */
export function useConcentrationFinalizePreview(id: string | undefined) {
  const detail = useConcentrationDetail(id);
  const stock = useFeedStock();

  const linkedFeedItemIds = useMemo(
    () => [...new Set((detail.data?.ingredients ?? []).map((i) => i.feed_item_id).filter((v): v is string => v != null))],
    [detail.data],
  );

  const feedItemQueries = useQueries({
    queries: linkedFeedItemIds.map((feedItemId) => ({
      queryKey: qk.inventory.feedItemDetail(feedItemId),
      queryFn: () => inventoryApi.findFeedItem(feedItemId),
      enabled: Boolean(id),
      staleTime: STALE_TIME,
    })),
  });
  const feedItemById = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof inventoryApi.findFeedItem>>>();
    for (const q of feedItemQueries) if (q.data) map.set(q.data.id, q.data);
    return map;
  }, [feedItemQueries]);
  const feedStockById = useMemo(() => new Map((stock.data ?? []).map((s) => [s.id, s])), [stock.data]);

  const isLoading = detail.isLoading || stock.isLoading || (linkedFeedItemIds.length > 0 && feedItemQueries.some((q) => q.isLoading));
  const isError = detail.isError || stock.isError || feedItemQueries.some((q) => q.isError);

  const result = useMemo(() => {
    const lines = detail.data?.ingredients ?? [];
    const unlinked = lines.filter((l) => !l.feed_item_id && !l.feed_stock_id);
    const linked = lines.filter((l) => l.feed_item_id || l.feed_stock_id);
    const unlinkedCostTk = unlinked.reduce((sum, l) => sum + l.cost_tk, 0);

    const neededByFeedItem = new Map<string, number>();
    const neededByFeedStock = new Map<string, number>();
    for (const l of linked) {
      if (l.feed_item_id) neededByFeedItem.set(l.feed_item_id, (neededByFeedItem.get(l.feed_item_id) ?? 0) + l.amount_kg);
      else if (l.feed_stock_id) neededByFeedStock.set(l.feed_stock_id, (neededByFeedStock.get(l.feed_stock_id) ?? 0) + l.amount_kg);
    }

    const shortfalls: { name: string; neededKg: number; availableKg: number }[] = [];
    const unchecked: { name: string }[] = [];
    for (const [feedItemId, neededKg] of neededByFeedItem) {
      const item = feedItemById.get(feedItemId);
      if (!item) continue;
      if (item.kgEquivalent == null) {
        unchecked.push({ name: item.name });
        continue;
      }
      if (neededKg > item.kgEquivalent) shortfalls.push({ name: item.name, neededKg, availableKg: item.kgEquivalent });
    }
    for (const [feedStockId, neededKg] of neededByFeedStock) {
      const lot = feedStockById.get(feedStockId);
      if (!lot) continue;
      if (neededKg > lot.current_stock_kg) shortfalls.push({ name: lot.id, neededKg, availableKg: lot.current_stock_kg });
    }

    return {
      linkedLineCount: linked.length,
      unlinkedLineCount: unlinked.length,
      unlinkedCostTk,
      shortfalls,
      unchecked,
      canFinalize: shortfalls.length === 0,
    };
  }, [detail.data, feedItemById, feedStockById]);

  return { ...result, isLoading, isError };
}
