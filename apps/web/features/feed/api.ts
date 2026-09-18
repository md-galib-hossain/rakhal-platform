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
  FeedGridResult,
  FeedGroup,
  FeedGroupCattle,
  RequirementSettingsResult,
  FeedIngredient,
  FeedRequirementsResult,
  IngredientListFilters,
  FeedStock,
  FeedStockDetail,
  FinalizeConcentrationPayload,
  FinalizeConcentrationResult,
  LogDistributionPayload,
  NormalizeConcentrationPayload,
  NormalizeConcentrationResult,
  PatchRefusalPayload,
  RefusalTrend,
  ResolvedRation,
  SaveFeedGridDraftPayload,
  SaveFeedGridDraftResult,
  SetFeedOverridePayload,
  TodaysFeedRequirement,
  UpdateCustomIngredientPayload,
  UpdateFeedConcentrationPayload,
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
  /** `weightKg`/`milkTargetL` (manual mode) vs `cattleId`/`feedGroupId` (cow-driven mode, added
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
    feedGroupId?: string;
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
  finalizeConcentration(id: string, dto?: FinalizeConcentrationPayload): Promise<FinalizeConcentrationResult> {
    return apiFetch<FinalizeConcentrationResult>(`/feed/concentrations/${id}/finalize`, { method: "POST", body: dto });
  },
  normalize(dto: NormalizeConcentrationPayload): Promise<NormalizeConcentrationResult> {
    return apiFetch<NormalizeConcentrationResult>("/feed/concentrations/normalize", { method: "POST", body: dto });
  },
  // ---- Feed groups (Settings-owned, `/settings/feed-groups` — read-only from this feature except
  // for setting a group's default recipe below, 2026-08-14) -------------------------------------
  listFeedGroups(): Promise<FeedGroup[]> {
    return apiFetch<FeedGroup[]>("/settings/feed-groups");
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
  /** Cattle currently in a feed group (RFE-102 is the first consumer — the route has existed
   * since Phase 4 with no UI). */
  listGroupCattle(groupId: string): Promise<FeedGroupCattle[]> {
    return apiFetch<FeedGroupCattle[]>(`/feed/groups/${groupId}/cattle`);
  },
  /** Move cattle into a feed group. Returns how many moved and how many were rejected
   * (another farm's cow, or one already gone). */
  assignCattleToGroup(groupId: string, cattleIds: string[]): Promise<{ assigned: number; failed: number }> {
    return apiFetch(`/feed/groups/${groupId}/assign-cattle`, {
      method: "POST",
      body: { cattleIds },
    });
  },
  /** "Set as default for this group" (Concentrate Mixer/TMR card action) — `null` clears it. */
  setGroupDefaultConcentration(groupId: string, concentrationId: string | null): Promise<FeedGroup> {
    return apiFetch<FeedGroup>(`/settings/feed-groups/${groupId}`, {
      method: "PATCH",
      body: { defaultConcentrationId: concentrationId },
    });
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
  /** "Feed Today" — the target (group vs one cow) is derived server-side from `concentrationId`,
   * never supplied here directly (see `LogDistributionPayload`'s doc comment). */
  logDistribution(dto: LogDistributionPayload): Promise<FeedDistribution> {
    return apiFetch<FeedDistribution>("/feed/distributions", { method: "POST", body: dto });
  },
  listDistributions(params: {
    feedGroupId?: string;
    cattleId?: string;
    concentrationId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<CursorPage<FeedDistributionSummary>> {
    return apiFetchPage<FeedDistributionSummary>("/feed/distributions", { searchParams: params });
  },
  /** Exactly one of `feedGroupId`/`cattleId` (backend `@ValidateIf` cross-check). */
  getEfficiency(params: { feedGroupId?: string; cattleId?: string; month?: string }): Promise<FeedEfficiencyResult> {
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
  getFeedGrid(params: { date: string; feedGroupId?: string }): Promise<FeedGridResult> {
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
  /** Next-day leftover weigh-in. */
  patchRefusal(distributionId: string, dto: PatchRefusalPayload): Promise<FeedDistribution> {
    return apiFetch<FeedDistribution>(`/feed/distributions/${distributionId}/refusal`, {
      method: "PATCH",
      body: dto,
    });
  },
  getRefusalTrend(feedGroupId: string, days?: number): Promise<RefusalTrend> {
    return apiFetch<RefusalTrend>(`/feed/groups/${feedGroupId}/refusal-trend`, {
      searchParams: days ? { days } : undefined,
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
