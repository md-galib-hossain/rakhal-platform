"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  BulkDeleteConcentrationPayload,
  CreateCustomIngredientPayload,
  CreateFeedConcentrationPayload,
  FeedConcentrationDetail,
  FeedConcentrationKind,
  FeedConcentrationSummary,
  FeedDistribution,
  FeedDistributionSummary,
  FeedEfficiencyResult,
  FeedGroup,
  FeedIngredient,
  FeedRequirementsResult,
  FeedStock,
  FeedStockDetail,
  FinalizeConcentrationResult,
  LogDistributionPayload,
  NormalizeConcentrationPayload,
  NormalizeConcentrationResult,
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
  createCustomIngredient(dto: CreateCustomIngredientPayload): Promise<FeedIngredient> {
    return apiFetch<FeedIngredient>("/feed/ingredients/custom", { method: "POST", body: dto });
  },
  /** `weightKg`/`milkTargetL` (manual mode) vs `cattleId`/`feedGroupId` (cow-driven mode, added
   * 2026-07-18 for the standalone nutrition calculator — see `types.ts`'s `FeedRequirementsResult`
   * doc comment) are mutually exclusive by convention, mirroring the backend DTO. */
  requirements(params: {
    weightKg?: number;
    milkTargetL?: number;
    milkFatPct?: number;
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
  finalizeConcentration(id: string): Promise<FinalizeConcentrationResult> {
    return apiFetch<FinalizeConcentrationResult>(`/feed/concentrations/${id}/finalize`, { method: "POST" });
  },
  normalize(dto: NormalizeConcentrationPayload): Promise<NormalizeConcentrationResult> {
    return apiFetch<NormalizeConcentrationResult>("/feed/concentrations/normalize", { method: "POST", body: dto });
  },
  // ---- Feed groups (Settings-owned, `/settings/feed-groups` — read-only from this feature) -----
  listFeedGroups(): Promise<FeedGroup[]> {
    return apiFetch<FeedGroup[]>("/settings/feed-groups");
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
};
