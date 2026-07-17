"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  BulkDeleteConcentrationPayload,
  CreateCustomIngredientPayload,
  CreateFeedConcentrationPayload,
  FeedConcentrationDetail,
  FeedConcentrationKind,
  FeedConcentrationSummary,
  FeedGroup,
  FeedIngredient,
  FeedRequirementsResult,
  FinalizeConcentrationResult,
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
};
