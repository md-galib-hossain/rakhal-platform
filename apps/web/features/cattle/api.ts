"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  Breed,
  BulkAction,
  BulkCattleResult,
  CattleHighlights,
  CattleListFilters,
  CattleListItem,
  FeedGroup,
  Shed,
} from "./types";

/** `GET/POST /cattle*` — real backend routes (`cattle.controller.ts`), `cattle.read`/`cattle.bulk`-gated.
 * Breed/shed/feed-group lookups back the filter selects — their own controllers (`/breeds`, `/sheds`,
 * `/settings/feed-groups`), not `/cattle`. */
export const cattleApi = {
  list(filters: CattleListFilters, cursor?: string): Promise<CursorPage<CattleListItem>> {
    return apiFetchPage<CattleListItem>("/cattle", {
      searchParams: {
        search: filters.search,
        breedId: filters.breedId,
        shedId: filters.shedId,
        feedGroupId: filters.feedGroupId,
        productionStatus: filters.productionStatus,
        healthStatus: filters.healthStatus,
        cursor,
        limit: 20,
      },
    });
  },
  highlights(): Promise<CattleHighlights> {
    return apiFetch<CattleHighlights>("/cattle/highlights");
  },
  bulk(
    cattleIds: string[],
    action: BulkAction,
    payload?: { shedId?: string; feedGroupId?: string },
  ): Promise<BulkCattleResult> {
    return apiFetch<BulkCattleResult>("/cattle/bulk", {
      method: "POST",
      body: { cattleIds, action, payload },
    });
  },
  /** Generous `limit` — filter dropdowns want the farm's full (small) list, not one page. */
  breeds(): Promise<CursorPage<Breed>> {
    return apiFetchPage<Breed>("/breeds", { searchParams: { limit: 100 } });
  },
  sheds(): Promise<CursorPage<Shed>> {
    return apiFetchPage<Shed>("/sheds", { searchParams: { limit: 100 } });
  },
  feedGroups(): Promise<FeedGroup[]> {
    return apiFetch<FeedGroup[]>("/settings/feed-groups");
  },
};
