"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  Breed,
  BulkAction,
  BulkCattleResult,
  CattleDetail,
  CattleFormPayload,
  CattleHighlights,
  CattleListFilters,
  CattleListItem,
  FeedGroup,
  MediaUrls,
  Shed,
} from "./types";
import type { CattleArchiveInput, CattleStatusInput } from "./schemas";

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
  findOne(id: string): Promise<CattleDetail> {
    return apiFetch<CattleDetail>(`/cattle/${id}`);
  },
  create(dto: CattleFormPayload): Promise<CattleDetail> {
    return apiFetch<CattleDetail>("/cattle", { method: "POST", body: dto });
  },
  update(id: string, dto: CattleFormPayload): Promise<CattleDetail> {
    return apiFetch<CattleDetail>(`/cattle/${id}`, { method: "PATCH", body: dto });
  },
  updateStatus(id: string, dto: CattleStatusInput): Promise<CattleDetail> {
    return apiFetch<CattleDetail>(`/cattle/${id}/status`, { method: "PATCH", body: dto });
  },
  /** `DELETE /cattle/:id` — soft-archive with an optional reason (sold/deceased/archived). */
  archive(id: string, dto: CattleArchiveInput): Promise<CattleDetail> {
    return apiFetch<CattleDetail>(`/cattle/${id}`, { method: "DELETE", body: dto });
  },
  restore(id: string): Promise<CattleDetail> {
    return apiFetch<CattleDetail>(`/cattle/${id}/restore`, { method: "PATCH" });
  },
  setPhoto(id: string, file: File): Promise<MediaUrls> {
    return apiUpload<MediaUrls>(`/cattle/${id}/photo`, file);
  },
  removePhoto(id: string): Promise<{ removed: boolean }> {
    return apiFetch<{ removed: boolean }>(`/cattle/${id}/photo`, { method: "DELETE" });
  },
};
