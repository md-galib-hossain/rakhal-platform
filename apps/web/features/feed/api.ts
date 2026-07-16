"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  CreateFeedConcentrationPayload,
  FeedConcentrationDetail,
  FeedConcentrationSummary,
  FeedGroup,
  FeedIngredient,
  FeedRequirementsResult,
  NormalizeConcentrationPayload,
  NormalizeConcentrationResult,
} from "./types";

/** `/feed/*` — real backend routes (`feed.controller.ts`), `feed.*`-gated + the Starter/Pro
 * `feed.formulator` subscription feature gate. Not cursor-paginated (`listConcentrations`/
 * `listIngredients` return a plain array, confirmed via `feed-concentration.service.ts`/
 * `feed-ingredient.service.ts` — no `CursorPaginationQueryDto` anywhere in this module). */
export const feedApi = {
  listIngredients(): Promise<FeedIngredient[]> {
    return apiFetch<FeedIngredient[]>("/feed/ingredients");
  },
  requirements(weightKg: number, milkTargetL: number, milkFatPct?: number): Promise<FeedRequirementsResult> {
    return apiFetch<FeedRequirementsResult>("/feed/requirements", {
      searchParams: { weightKg, milkTargetL, milkFatPct },
    });
  },
  listConcentrations(): Promise<FeedConcentrationSummary[]> {
    return apiFetch<FeedConcentrationSummary[]>("/feed/concentrations");
  },
  getConcentration(id: string): Promise<FeedConcentrationDetail> {
    return apiFetch<FeedConcentrationDetail>(`/feed/concentrations/${id}`);
  },
  createConcentration(dto: CreateFeedConcentrationPayload): Promise<FeedConcentrationDetail> {
    return apiFetch<FeedConcentrationDetail>("/feed/concentrations", { method: "POST", body: dto });
  },
  removeConcentration(id: string): Promise<{ id: string; archived: boolean }> {
    return apiFetch(`/feed/concentrations/${id}`, { method: "DELETE" });
  },
  normalize(dto: NormalizeConcentrationPayload): Promise<NormalizeConcentrationResult> {
    return apiFetch<NormalizeConcentrationResult>("/feed/concentrations/normalize", { method: "POST", body: dto });
  },
  // ---- Feed groups (Settings-owned, `/settings/feed-groups` — read-only from this feature) -----
  listFeedGroups(): Promise<FeedGroup[]> {
    return apiFetch<FeedGroup[]>("/settings/feed-groups");
  },
};
