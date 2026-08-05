"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  BcsRecordResult,
  Breed,
  BulkAction,
  BulkCattleResult,
  CattleDetail,
  CattleFormPayload,
  CattleHighlights,
  CattleImportConfirmResult,
  CattleImportPreview,
  CattleListFilters,
  CattleListItem,
  FeedGroup,
  MediaUrls,
  Shed,
  WeightRecordResult,
} from "./types";
import type { CattleArchiveInput, CattleStatusInput, RecordBcsInput, RecordWeightInput } from "./schemas";
import type {
  CalvingEventRow,
  CattleFinance,
  CattleOverview,
  CattlePedigree,
  HealthSummary,
  ReproductionSummary,
  WeightHistoryPeriod,
  WeightHistoryResponse,
} from "./detail-types";

/** `GET/POST /cattle*` — real backend routes (`cattle.controller.ts`), `cattle.read`/`cattle.bulk`-gated.
 * Breed/shed/feed-group lookups back the filter selects — their own controllers (`/breeds`, `/sheds`,
 * `/settings/feed-groups`), not `/cattle`. */
export const cattleApi = {
  list(filters: CattleListFilters, cursor?: string, limit = 20): Promise<CursorPage<CattleListItem>> {
    return apiFetchPage<CattleListItem>("/cattle", {
      searchParams: {
        search: filters.search,
        breedId: filters.breedId,
        shedId: filters.shedId,
        feedGroupId: filters.feedGroupId,
        productionStatus: filters.productionStatus,
        healthStatus: filters.healthStatus,
        purpose: filters.purpose,
        reproductiveStatus: filters.reproductiveStatus,
        animalCategory: filters.animalCategory,
        cursor,
        limit,
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
  createBreed(input: { name: string; description?: string }): Promise<Breed> {
    return apiFetch<Breed>("/breeds", { method: "POST", body: input });
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

  // RFE-023 — detail page tabs.
  overview(id: string): Promise<CattleOverview> {
    return apiFetch<CattleOverview>(`/cattle/${id}/overview`);
  },
  pedigree(id: string): Promise<CattlePedigree> {
    return apiFetch<CattlePedigree>(`/cattle/${id}/pedigree`);
  },
  /** `finance.read`-gated (separate from the rest of the cattle detail, which is `cattle.read`). */
  finance(id: string, period?: string): Promise<CattleFinance> {
    return apiFetch<CattleFinance>(`/cattle/${id}/finance`, { searchParams: { period } });
  },
  weightHistory(id: string, period: WeightHistoryPeriod): Promise<WeightHistoryResponse> {
    return apiFetch<WeightHistoryResponse>(`/cattle/${id}/weight/history`, { searchParams: { period } });
  },
  /** Female cattle only — the backend 400s for male/castrated (`getFemaleCattle`), so callers must
   * gate this behind `gender === "FEMALE"` rather than rely on catching the error. */
  reproductionSummary(id: string): Promise<ReproductionSummary> {
    return apiFetch<ReproductionSummary>(`/cattle/${id}/reproduction-summary`);
  },
  healthSummary(id: string): Promise<HealthSummary> {
    return apiFetch<HealthSummary>(`/cattle/${id}/health-summary`);
  },
  calvingEvents(cattleId: string): Promise<CursorPage<CalvingEventRow>> {
    return apiFetchPage<CalvingEventRow>("/reproduction/calving-events", {
      searchParams: { cattleId, limit: 20 },
    });
  },

  // RFE-023 follow-up — BCS + weight recording (`cattle.bcs`/`cattle.update`-gated on the backend).
  recordBcs(id: string, dto: RecordBcsInput): Promise<BcsRecordResult> {
    return apiFetch<BcsRecordResult>(`/cattle/${id}/bcs`, { method: "POST", body: dto });
  },
  recordWeight(id: string, dto: RecordWeightInput): Promise<WeightRecordResult> {
    return apiFetch<WeightRecordResult>(`/cattle/${id}/weight`, { method: "POST", body: dto });
  },

  // RFE-024 — CSV import (multipart preview → confirm, both `cattle.create`-gated).
  importPreview(file: File): Promise<CattleImportPreview> {
    return apiUpload<CattleImportPreview>("/cattle/import/preview", file);
  },
  importConfirm(importSessionId: string, skipErrors: boolean): Promise<CattleImportConfirmResult> {
    return apiFetch<CattleImportConfirmResult>("/cattle/import/confirm", {
      method: "POST",
      body: { importSessionId, skipErrors },
    });
  },
};
