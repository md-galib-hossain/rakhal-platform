"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AnimalGroup,
  AnimalHold,
  BcsRecordResult,
  Breed,
  BulkAction,
  BulkCattleResult,
  BulkDisposeType,
  CattleDetail,
  CattleFormPayload,
  CattleHighlights,
  CattleListFilters,
  CattleListItem,
  MediaUrls,
  PurchasedLactationResult,
  Shed,
  UpcomingEventsResult,
  WeightRecordResult,
} from "./types";
import type {
  CattleDeleteInput,
  CattleDisposeInput,
  CattleStatusInput,
  CreateAnimalHoldInput,
  PurchasedLactationInput,
  RecordBcsInput,
  RecordWeightInput,
  ReleaseAnimalHoldInput,
} from "./schemas";
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
 * Breed/shed/animal-group lookups back the filter selects — their own controllers (`/breeds`, `/sheds`,
 * `/animal-groups`), not `/cattle`. */
export const cattleApi = {
  list(filters: CattleListFilters, cursor?: string, limit = 20): Promise<CursorPage<CattleListItem>> {
    return apiFetchPage<CattleListItem>("/cattle", {
      searchParams: {
        search: filters.search,
        breedId: filters.breedId,
        shedId: filters.shedId,
        animalGroupId: filters.animalGroupId,
        productionStatus: filters.productionStatus,
        healthStatus: filters.healthStatus,
        reproductiveStatus: filters.reproductiveStatus,
        animalCategory: filters.animalCategory,
        status: filters.status,
        lifecycleSubStage: filters.lifecycleSubStage,
        dueFilter: filters.dueFilter,
        cursor,
        limit,
      },
    });
  },
  /** RAKHAL-475 — one animal's full upcoming-events list (the Next event popover). `limit` defaults to 10
   * server-side; `total` still counts everything in the window. */
  upcomingEvents(id: string, limit?: number): Promise<UpcomingEventsResult> {
    return apiFetch<UpcomingEventsResult>(`/cattle/${id}/upcoming-events`, { searchParams: { limit } });
  },
  highlights(): Promise<CattleHighlights> {
    return apiFetch<CattleHighlights>("/cattle/highlights");
  },
  bulk(
    cattleIds: string[],
    action: BulkAction,
    payload?: { shedId?: string; type?: BulkDisposeType; reason?: string; date?: string },
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
  /** Generous `limit` — pickers want the farm's full (small) list of groups, not one page. */
  animalGroups(search?: string): Promise<CursorPage<AnimalGroup>> {
    return apiFetchPage<AnimalGroup>("/animal-groups", { searchParams: { limit: 100, search } });
  },
  findAnimalGroup(id: string): Promise<AnimalGroup> {
    return apiFetch<AnimalGroup>(`/animal-groups/${id}`);
  },
  /** "Create group from selection" — one call creates the group and adds `cattleIds`. */
  createAnimalGroup(input: { name: string; description?: string; cattleIds?: string[] }): Promise<AnimalGroup> {
    return apiFetch<AnimalGroup>("/animal-groups", { method: "POST", body: input });
  },
  updateAnimalGroup(id: string, input: { name?: string; description?: string }): Promise<AnimalGroup> {
    return apiFetch<AnimalGroup>(`/animal-groups/${id}`, { method: "PATCH", body: input });
  },
  deleteAnimalGroup(id: string): Promise<{ id: string; deleted: boolean }> {
    return apiFetch<{ id: string; deleted: boolean }>(`/animal-groups/${id}`, { method: "DELETE" });
  },
  addToAnimalGroup(groupId: string, cattleIds: string[]): Promise<AnimalGroup & { added: number }> {
    return apiFetch<AnimalGroup & { added: number }>(`/animal-groups/${groupId}/members`, {
      method: "POST",
      body: { cattleIds },
    });
  },
  removeFromAnimalGroup(groupId: string, cattleIds: string[]): Promise<AnimalGroup & { removed: number }> {
    return apiFetch<AnimalGroup & { removed: number }>(`/animal-groups/${groupId}/members`, {
      method: "DELETE",
      body: { cattleIds },
    });
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
  /** RAKHAL-296-F — `POST /reproduction/cattle/:id/purchased-lactation` (RAKHAL-281). Reproduction
   * module's own route (not `/cattle/*`), called from the cattle status flow: the alternative to
   * `updateStatus`'s exact `lactationStartDate` when the farmer only knows an estimate (or nothing)
   * about a purchased already-milking cow's lactation. Also flips `productionStatus` to MILKING
   * server-side (`flipToMilking`), same as the exact-date path. */
  createPurchasedLactation(
    id: string,
    dto: PurchasedLactationInput,
  ): Promise<PurchasedLactationResult> {
    return apiFetch<PurchasedLactationResult>(`/reproduction/cattle/${id}/purchased-lactation`, {
      method: "POST",
      body: dto,
    });
  },
  /** RAKHAL-402 — real soft-delete only (`DELETE /cattle/:id`). Sends `reason: "archived"`, the
   * only value that still routes to `archiveWithReason()`'s plain-archive branch; the backend
   * refuses (409) when the animal has real history (milk logs/health cases/breeding events). */
  deleteCattle(id: string, dto: CattleDeleteInput): Promise<CattleDetail> {
    return apiFetch<CattleDetail>(`/cattle/${id}`, {
      method: "DELETE",
      body: { reason: "archived", notes: dto.notes },
    });
  },
  /** `POST /cattle/:id/dispose` (RAKHAL-399/402) — Cull/Death. Sold goes through
   * `features/sales`'s `RecordSaleTrigger`/`RecordSaleDialog` instead. */
  dispose(id: string, dto: CattleDisposeInput): Promise<CattleDetail> {
    return apiFetch<CattleDetail>(`/cattle/${id}/dispose`, { method: "POST", body: dto });
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

  // MILESTONE 10 gap closure — generic per-animal hold (RAKHAL-280, `cattle.hold`-gated).
  holds(cattleId: string): Promise<CursorPage<AnimalHold>> {
    return apiFetchPage<AnimalHold>(`/cattle/${cattleId}/holds`, { searchParams: { limit: 50 } });
  },
  createHold(cattleId: string, dto: CreateAnimalHoldInput): Promise<AnimalHold> {
    return apiFetch<AnimalHold>(`/cattle/${cattleId}/holds`, { method: "POST", body: dto });
  },
  releaseHold(cattleId: string, holdId: string, dto?: ReleaseAnimalHoldInput): Promise<AnimalHold> {
    return apiFetch<AnimalHold>(`/cattle/${cattleId}/holds/${holdId}/release`, {
      method: "PATCH",
      body: dto,
    });
  },
};
