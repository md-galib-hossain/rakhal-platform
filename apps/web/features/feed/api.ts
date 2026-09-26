"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  BulkDeleteConcentrationPayload,
  ConfirmFeedGridPayload,
  ConfirmFeedGridResult,
  CreateCustomIngredientPayload,
  CreateFeedConcentrationPayload,
  DmiComparison,
  EntryCalendarResult,
  FeedConcentrationDetail,
  FeedConcentrationKind,
  FeedConcentrationSummary,
  FeedConcentrationVersion,
  FeedCostSummary,
  FeedDistribution,
  FeedDistributionSummary,
  FeedEfficiencyResult,
  FeedCattleHistoryResult,
  FeedGridResult,
  RequirementSettingsResult,
  FeedIngredient,
  FeedRequirementsResult,
  IngredientListFilters,
  FeedStock,
  FeedStockDetail,
  ConcentrationInventoryCheck,
  FinalizeConcentrationPayload,
  FinalizeConcentrationResult,
  LogDistributionPayload,
  NormalizeConcentrationPayload,
  NormalizeConcentrationResult,
  PatchRefusalPayload,
  ResolvedRation,
  SaveFeedGridDraftPayload,
  SaveFeedGridDraftResult,
  SetFeedOverridePayload,
  TodaysFeedRequirement,
  UpdateCustomIngredientPayload,
  UpdateFeedConcentrationPayload,
  VoidFeedCattleItemPayload,
  VoidFeedCattleItemResult,
} from "./types";

/** `/feed/*` — real backend routes (`feed.controller.ts`), `feed.*`-gated + the Starter/Pro
 * `feed.formulator` subscription feature gate. Not cursor-paginated (`listConcentrations`/
 * `listIngredients` return a plain array, confirmed via `feed-concentration.service.ts`/
 * `feed-ingredient.service.ts` — no `CursorPaginationQueryDto` anywhere in this module). */
export const feedApi = {
  listIngredients(): Promise<FeedIngredient[]> {
    return apiFetch<FeedIngredient[]>("/feed/ingredients");
  },
  /** `GET /feed/ingredients/paged` — cursor-paginated + filterable, for the Ingredients management
   * table (2026-08-14). Kept separate from `listIngredients` above, which stays the plain unpaginated
   * array the picker/create-dialog/detail-sheet need for full-catalogue selection. */
  listIngredientsPaged(
    filters: IngredientListFilters,
    cursor?: string,
    limit = 20,
  ): Promise<CursorPage<FeedIngredient>> {
    return apiFetchPage<FeedIngredient>("/feed/ingredients/paged", {
      searchParams: {
        search: filters.search,
        feedClass: filters.feedClass?.length ? filters.feedClass.join(",") : undefined,
        priceMin: filters.priceMin,
        priceMax: filters.priceMax,
        cursor,
        limit,
      },
    });
  },
  createCustomIngredient(dto: CreateCustomIngredientPayload): Promise<FeedIngredient> {
    return apiFetch<FeedIngredient>("/feed/ingredients/custom", { method: "POST", body: dto });
  },
  updateCustomIngredient(id: string, dto: UpdateCustomIngredientPayload): Promise<FeedIngredient> {
    return apiFetch<FeedIngredient>(`/feed/ingredients/custom/${id}`, { method: "PATCH", body: dto });
  },
  deleteCustomIngredient(id: string): Promise<FeedIngredient> {
    return apiFetch<FeedIngredient>(`/feed/ingredients/custom/${id}`, { method: "DELETE" });
  },
  setIngredientOverride(id: string, dto: SetFeedOverridePayload): Promise<unknown> {
    return apiFetch(`/feed/ingredients/${id}/override`, { method: "POST", body: dto });
  },
  resetIngredientOverride(id: string): Promise<unknown> {
    return apiFetch(`/feed/ingredients/${id}/override`, { method: "DELETE" });
  },
  /** `weightKg`/`milkTargetL` (manual mode) vs `cattleId` (cow-driven mode, added
   * 2026-07-18 for the standalone nutrition calculator — see `types.ts`'s `FeedRequirementsResult`
   * doc comment) are mutually exclusive by convention, mirroring the backend DTO. */
  requirements(params: {
    weightKg?: number;
    milkTargetL?: number;
    milkFatPct?: number;
    /** RFE-103: these five were accepted by the backend from the start but never forwarded,
     * which is what limited the wizard to a weight/milk-only requirement. */
    milkProteinPct?: number;
    gestationDays?: number;
    bcs?: number;
    dim?: number;
    animalType?: "COW" | "HEIFER" | "DRY";
    cattleId?: string;
  }): Promise<FeedRequirementsResult> {
    return apiFetch<FeedRequirementsResult>("/feed/requirements", { searchParams: params });
  },
  listConcentrations(kind?: FeedConcentrationKind): Promise<FeedConcentrationSummary[]> {
    return apiFetch<FeedConcentrationSummary[]>("/feed/concentrations", {
      searchParams: kind ? { kind } : undefined,
    });
  },
  getConcentration(id: string): Promise<FeedConcentrationDetail> {
    return apiFetch<FeedConcentrationDetail>(`/feed/concentrations/${id}`);
  },
  createConcentration(dto: CreateFeedConcentrationPayload): Promise<FeedConcentrationDetail> {
    return apiFetch<FeedConcentrationDetail>("/feed/concentrations", { method: "POST", body: dto });
  },
  updateConcentration(id: string, dto: UpdateFeedConcentrationPayload): Promise<FeedConcentrationDetail> {
    return apiFetch<FeedConcentrationDetail>(`/feed/concentrations/${id}`, { method: "PATCH", body: dto });
  },
  removeConcentration(id: string): Promise<{ id: string; archived: boolean }> {
    return apiFetch(`/feed/concentrations/${id}`, { method: "DELETE" });
  },
  bulkDeleteConcentrations(dto: BulkDeleteConcentrationPayload): Promise<{ deleted: number }> {
    return apiFetch("/feed/concentrations/bulk-delete", { method: "POST", body: dto });
  },
  /** Promote a Concentrate Mixer template into a reusable ingredient + stock batch (user request
   * 2026-07-17/18) — only valid on a `CONCENTRATE_TEMPLATE`. */
  getConcentrationInventoryCheck(id: string): Promise<ConcentrationInventoryCheck> {
    return apiFetch<ConcentrationInventoryCheck>(`/feed/concentrations/${id}/inventory-check`);
  },
  finalizeConcentration(id: string, dto?: FinalizeConcentrationPayload): Promise<FinalizeConcentrationResult> {
    return apiFetch<FinalizeConcentrationResult>(`/feed/concentrations/${id}/finalize`, { method: "POST", body: dto });
  },
  normalize(dto: NormalizeConcentrationPayload): Promise<NormalizeConcentrationResult> {
    return apiFetch<NormalizeConcentrationResult>("/feed/concentrations/normalize", { method: "POST", body: dto });
  },
  // ---- Requirement settings (RFE-104, backend RAKHAL-409) ------------------
  /** The farm's effective tuning numbers plus the layers behind them and the field metadata. */
  requirementSettings(): Promise<RequirementSettingsResult> {
    return apiFetch<RequirementSettingsResult>("/feed/requirement-settings");
  },
  /** Sparse — only the fields being changed. Everything absent inherits. */
  updateRequirementSettings(
    changes: Record<string, number>,
    notes?: string,
  ): Promise<RequirementSettingsResult> {
    return apiFetch<RequirementSettingsResult>("/feed/requirement-settings", {
      method: "PUT",
      body: { changes, notes },
    });
  },
  /** Drop this farm's changes and go back to the standard model. */
  resetRequirementSettings(): Promise<RequirementSettingsResult> {
    return apiFetch<RequirementSettingsResult>("/feed/requirement-settings", { method: "DELETE" });
  },
  // ---- Feed stock + distribution (Phase 12.4, 2026-07-18 — the backend for these has existed
  // since Phase 4, this is the first frontend consumer) ---------------------------------------
  listStock(): Promise<FeedStock[]> {
    return apiFetch<FeedStock[]>("/feed/stock");
  },
  getStock(id: string): Promise<FeedStockDetail> {
    return apiFetch<FeedStockDetail>(`/feed/stock/${id}`);
  },
  /** Delete a stock lot from inventory (user request 2026-07-19 — "form inventory it can be also
   * deleted"). Soft-delete on the backend. */
  archiveStock(id: string): Promise<FeedStock> {
    return apiFetch<FeedStock>(`/feed/stock/${id}`, { method: "DELETE" });
  },
  /** Multi-select delete (bulk-action dock, 2026-07-21). */
  bulkDeleteStock(ids: string[]): Promise<{ deleted: number }> {
    return apiFetch("/feed/stock/bulk-delete", { method: "POST", body: { ids } });
  },
  /** "Feed Today" — the target (one cow vs the herd) is derived server-side from `concentrationId`,
   * never supplied here directly (see `LogDistributionPayload`'s doc comment). */
  logDistribution(dto: LogDistributionPayload): Promise<FeedDistribution> {
    return apiFetch<FeedDistribution>("/feed/distributions", { method: "POST", body: dto });
  },
  listDistributions(params: {
    cattleId?: string;
    concentrationId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<CursorPage<FeedDistributionSummary>> {
    return apiFetchPage<FeedDistributionSummary>("/feed/distributions", { searchParams: params });
  },
  /** `cattleId` is required. */
  getEfficiency(params: { cattleId: string; month?: string }): Promise<FeedEfficiencyResult> {
    return apiFetch<FeedEfficiencyResult>("/feed/efficiency", { searchParams: params });
  },

  // ---- Feeding-system upgrade (2026-08-13, user request) -------------------------------------

  /** Layered targeting resolution — which active ration this cow is actually on. */
  getResolvedRation(cattleId: string): Promise<ResolvedRation> {
    return apiFetch<ResolvedRation>(`/feed/cattle/${cattleId}/resolved-ration`);
  },
  getDmi(cattleId: string, date?: string): Promise<DmiComparison> {
    return apiFetch<DmiComparison>(`/feed/cattle/${cattleId}/dmi`, { searchParams: date ? { date } : undefined });
  },
  getTodaysRequirement(): Promise<TodaysFeedRequirement> {
    return apiFetch<TodaysFeedRequirement>("/feed/today-requirement");
  },
  /** Feeding Grid (2026-08-15) — replaces the single-item Quick Feed dialog. One row per cow, one
   * source item per Save/Confirm call, `entries` is per-cow quantity. */
  getFeedGrid(params: { date: string }): Promise<FeedGridResult> {
    return apiFetch<FeedGridResult>("/feed/grid", { searchParams: params });
  },
  /** RAKHAL-434/RFE-118 — per-day feeding-entry status for the missed-entry calendar picker. */
  getFeedGridCalendar(month: string): Promise<EntryCalendarResult> {
    return apiFetch<EntryCalendarResult>("/feed/grid/calendar", { searchParams: { month } });
  },
  saveFeedGridDraft(dto: SaveFeedGridDraftPayload): Promise<SaveFeedGridDraftResult> {
    return apiFetch<SaveFeedGridDraftResult>("/feed/grid/draft", { method: "POST", body: dto });
  },
  confirmFeedGrid(dto: ConfirmFeedGridPayload): Promise<ConfirmFeedGridResult> {
    return apiFetch<ConfirmFeedGridResult>("/feed/grid/confirm", { method: "POST", body: dto });
  },
  /** RAKHAL-441 frontend twin (per-cow) — one cow's own feeding entries for one exact day
   * (server defaults to today when `date` is omitted), backing the per-cow History panel opened
   * from that cow's own Feeding Grid row. */
  getFeedCattleHistory(cattleId: string, date?: string): Promise<FeedCattleHistoryResult> {
    return apiFetch<FeedCattleHistoryResult>(`/feed/grid/cattle/${cattleId}/history`, {
      searchParams: date ? { date } : undefined,
    });
  },
  /** RAKHAL-441 — void exactly one cow's confirmed line: credits back stock, shrinks the sibling
   * item/parent totals, excludes it from per-animal feed cost. Idempotent on a repeat call. */
  voidFeedCattleItem(
    distributionId: string,
    cattleItemId: string,
    dto: VoidFeedCattleItemPayload,
  ): Promise<VoidFeedCattleItemResult> {
    return apiFetch<VoidFeedCattleItemResult>(
      `/feed/grid/distributions/${distributionId}/cattle/${cattleItemId}/void`,
      { method: "POST", body: dto },
    );
  },
  /** Next-day leftover weigh-in. */
  patchRefusal(distributionId: string, dto: PatchRefusalPayload): Promise<FeedDistribution> {
    return apiFetch<FeedDistribution>(`/feed/distributions/${distributionId}/refusal`, {
      method: "PATCH",
      body: dto,
    });
  },
  /** Explicit-checkpoint versioning, `FEED_MIXTURE` only — day-to-day edits stay live-sync. */
  saveVersion(concentrationId: string, name?: string): Promise<FeedConcentrationVersion> {
    return apiFetch<FeedConcentrationVersion>(`/feed/concentrations/${concentrationId}/save-version`, {
      method: "POST",
      body: name ? { name } : undefined,
    });
  },
  listVersions(concentrationId: string): Promise<FeedConcentrationVersion[]> {
    return apiFetch<FeedConcentrationVersion[]>(`/feed/concentrations/${concentrationId}/versions`);
  },
  getCostSummary(days?: number): Promise<FeedCostSummary> {
    return apiFetch<FeedCostSummary>("/feed/cost-summary", { searchParams: days ? { days } : undefined });
  },
};
