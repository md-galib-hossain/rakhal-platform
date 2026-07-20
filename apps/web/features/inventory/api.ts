"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AdjustMedicineStockPayload,
  AdjustMilkTankVolumePayload,
  CreateFeedItemPayload,
  CreateMedicinePayload,
  CreateEquipmentPayload,
  CreateMilkTankPayload,
  CreateSemenBatchPayload,
  CreateSemenTankPayload,
  Equipment,
  EquipmentListFilters,
  FeedItem,
  FeedItemListFilters,
  Medicine,
  MedicineListFilters,
  MediaUrls,
  MilkTank,
  MilkTankAuditLogEntry,
  MilkTankListFilters,
  MilkTankShed,
  MilkTankTeamMember,
  SemenBatch,
  SemenBatchListFilters,
  SemenTank,
  UpdateEquipmentPayload,
  UpdateFeedItemPayload,
  UpdateMedicinePayload,
  UpdateMilkTankPayload,
  UpdateSemenBatchPayload,
  UpdateSemenTankPayload,
} from "./types";

/** `/inventory/medicines*` — real backend routes (`medicine.controller.ts`), `inventory.*`-gated. */
export const inventoryApi = {
  listMedicines(filters: MedicineListFilters, cursor?: string): Promise<CursorPage<Medicine>> {
    return apiFetchPage<Medicine>("/inventory/medicines", {
      searchParams: { search: filters.search, category: filters.category, status: filters.status, cursor, limit: 20 },
    });
  },
  findMedicine(id: string): Promise<Medicine> {
    return apiFetch<Medicine>(`/inventory/medicines/${id}`);
  },
  createMedicine(dto: CreateMedicinePayload): Promise<Medicine> {
    return apiFetch<Medicine>("/inventory/medicines", { method: "POST", body: dto });
  },
  updateMedicine(id: string, dto: UpdateMedicinePayload): Promise<Medicine> {
    return apiFetch<Medicine>(`/inventory/medicines/${id}`, { method: "PATCH", body: dto });
  },
  adjustMedicineStock(id: string, dto: AdjustMedicineStockPayload): Promise<Medicine> {
    return apiFetch<Medicine>(`/inventory/medicines/${id}/adjust-stock`, { method: "POST", body: dto });
  },
  archiveMedicine(id: string): Promise<Medicine> {
    return apiFetch<Medicine>(`/inventory/medicines/${id}/archive`, { method: "PATCH" });
  },
  restoreMedicine(id: string): Promise<Medicine> {
    return apiFetch<Medicine>(`/inventory/medicines/${id}/restore`, { method: "PATCH" });
  },
  setMedicinePhoto(id: string, file: File): Promise<MediaUrls> {
    return apiUpload<MediaUrls>(`/inventory/medicines/${id}/photo`, file);
  },
  removeMedicinePhoto(id: string): Promise<{ removed: boolean }> {
    return apiFetch<{ removed: boolean }>(`/inventory/medicines/${id}/photo`, { method: "DELETE" });
  },
  /** Multi-select delete (bulk-action dock, 2026-07-21). */
  bulkDeleteMedicines(ids: string[]): Promise<{ deleted: number }> {
    return apiFetch("/inventory/medicines/bulk-delete", { method: "POST", body: { ids } });
  },

  /** `/inventory/feed-items*` — real backend routes (`feed-item.controller.ts`). No photo endpoints
   * (see `types.ts#FeedItem` doc comment) and no separate adjust-stock route — `currentStock` goes
   * through the normal update call. */
  listFeedItems(filters: FeedItemListFilters, cursor?: string): Promise<CursorPage<FeedItem>> {
    return apiFetchPage<FeedItem>("/inventory/feed-items", {
      searchParams: { search: filters.search, feedClass: filters.feedClass, cursor, limit: 20 },
    });
  },
  findFeedItem(id: string): Promise<FeedItem> {
    return apiFetch<FeedItem>(`/inventory/feed-items/${id}`);
  },
  createFeedItem(dto: CreateFeedItemPayload): Promise<FeedItem> {
    return apiFetch<FeedItem>("/inventory/feed-items", { method: "POST", body: dto });
  },
  updateFeedItem(id: string, dto: UpdateFeedItemPayload): Promise<FeedItem> {
    return apiFetch<FeedItem>(`/inventory/feed-items/${id}`, { method: "PATCH", body: dto });
  },
  archiveFeedItem(id: string): Promise<FeedItem> {
    return apiFetch<FeedItem>(`/inventory/feed-items/${id}/archive`, { method: "PATCH" });
  },
  restoreFeedItem(id: string): Promise<FeedItem> {
    return apiFetch<FeedItem>(`/inventory/feed-items/${id}/restore`, { method: "PATCH" });
  },
  /** Multi-select delete (bulk-action dock, 2026-07-21). */
  bulkDeleteFeedItems(ids: string[]): Promise<{ deleted: number }> {
    return apiFetch("/inventory/feed-items/bulk-delete", { method: "POST", body: { ids } });
  },

  /** `/inventory/milk-tanks*` — real backend routes (`milk-tank.controller.ts`). No separate
   * restore route (archive is the only soft-delete transition exposed) and volume never goes through
   * a plain `PATCH` — always the audited `adjust-volume` endpoint (see `AdjustMilkTankVolumePayload`). */
  listMilkTanks(filters: MilkTankListFilters): Promise<MilkTank[]> {
    return apiFetch<MilkTank[]>("/inventory/milk-tanks", {
      searchParams: { tankType: filters.tankType, includeArchived: filters.includeArchived },
    });
  },
  findMilkTank(id: string): Promise<MilkTank> {
    return apiFetch<MilkTank>(`/inventory/milk-tanks/${id}`);
  },
  createMilkTank(dto: CreateMilkTankPayload): Promise<MilkTank> {
    return apiFetch<MilkTank>("/inventory/milk-tanks", { method: "POST", body: dto });
  },
  updateMilkTank(id: string, dto: UpdateMilkTankPayload): Promise<MilkTank> {
    return apiFetch<MilkTank>(`/inventory/milk-tanks/${id}`, { method: "PATCH", body: dto });
  },
  adjustMilkTankVolume(id: string, dto: AdjustMilkTankVolumePayload): Promise<MilkTank> {
    return apiFetch<MilkTank>(`/inventory/milk-tanks/${id}/adjust-volume`, { method: "POST", body: dto });
  },
  archiveMilkTank(id: string): Promise<MilkTank> {
    return apiFetch<MilkTank>(`/inventory/milk-tanks/${id}`, { method: "DELETE" });
  },
  milkTankAuditLog(tankId: string | undefined, cursor?: string): Promise<CursorPage<MilkTankAuditLogEntry>> {
    return apiFetchPage<MilkTankAuditLogEntry>("/inventory/milk-tanks/audit-log", {
      searchParams: { tankId, cursor, limit: 10 },
    });
  },
  /** Generous `limit` — the "Assigned Shed" select wants the farm's full (small) list, not one page.
   * Same `/sheds` endpoint `cattleApi.sheds()` hits, duplicated per this file's own feature-local
   * siloing convention (see `types.ts#MilkTankShed`). */
  shedsForMilkTank(): Promise<CursorPage<MilkTankShed>> {
    return apiFetchPage<MilkTankShed>("/sheds", { searchParams: { limit: 100 } });
  },
  /** `GET /settings/team` (`team.read`-gated) — best-effort operator-name lookup for the audit log,
   * see `types.ts#MilkTankTeamMember`. */
  teamMembersForMilkAudit(): Promise<{ members: MilkTankTeamMember[] }> {
    return apiFetch<{ members: MilkTankTeamMember[] }>("/settings/team");
  },

  /** `/inventory/semen/tanks*` — real backend routes (`semen.controller.ts`). Returns the full
   * (small) array directly, same as milk tanks — no cursor pager. */
  listSemenTanks(): Promise<SemenTank[]> {
    return apiFetch<SemenTank[]>("/inventory/semen/tanks");
  },
  createSemenTank(dto: CreateSemenTankPayload): Promise<SemenTank> {
    return apiFetch<SemenTank>("/inventory/semen/tanks", { method: "POST", body: dto });
  },
  updateSemenTank(id: string, dto: UpdateSemenTankPayload): Promise<SemenTank> {
    return apiFetch<SemenTank>(`/inventory/semen/tanks/${id}`, { method: "PATCH", body: dto });
  },
  archiveSemenTank(id: string): Promise<SemenTank> {
    return apiFetch<SemenTank>(`/inventory/semen/tanks/${id}`, { method: "DELETE" });
  },

  /** `/inventory/semen/batches*` — real backend routes, cursor-paginated. */
  listSemenBatches(filters: SemenBatchListFilters, cursor?: string): Promise<CursorPage<SemenBatch>> {
    return apiFetchPage<SemenBatch>("/inventory/semen/batches", {
      searchParams: { search: filters.search, tankId: filters.tankId, includeArchived: filters.includeArchived, cursor, limit: 20 },
    });
  },
  createSemenBatch(dto: CreateSemenBatchPayload): Promise<SemenBatch> {
    return apiFetch<SemenBatch>("/inventory/semen/batches", { method: "POST", body: dto });
  },
  updateSemenBatch(id: string, dto: UpdateSemenBatchPayload): Promise<SemenBatch> {
    return apiFetch<SemenBatch>(`/inventory/semen/batches/${id}`, { method: "PATCH", body: dto });
  },
  archiveSemenBatch(id: string): Promise<SemenBatch> {
    return apiFetch<SemenBatch>(`/inventory/semen/batches/${id}`, { method: "DELETE" });
  },

  /** `/inventory/equipment*` — real backend routes (`equipment.controller.ts`). */
  listEquipment(filters: EquipmentListFilters, cursor?: string): Promise<CursorPage<Equipment>> {
    return apiFetchPage<Equipment>("/inventory/equipment", {
      searchParams: { search: filters.search, type: filters.type, cursor, limit: 20 },
    });
  },
  findEquipment(id: string): Promise<Equipment> {
    return apiFetch<Equipment>(`/inventory/equipment/${id}`);
  },
  createEquipment(dto: CreateEquipmentPayload): Promise<Equipment> {
    return apiFetch<Equipment>("/inventory/equipment", { method: "POST", body: dto });
  },
  updateEquipment(id: string, dto: UpdateEquipmentPayload): Promise<Equipment> {
    return apiFetch<Equipment>(`/inventory/equipment/${id}`, { method: "PATCH", body: dto });
  },
  archiveEquipment(id: string): Promise<Equipment> {
    return apiFetch<Equipment>(`/inventory/equipment/${id}/archive`, { method: "PATCH" });
  },
  restoreEquipment(id: string): Promise<Equipment> {
    return apiFetch<Equipment>(`/inventory/equipment/${id}/restore`, { method: "PATCH" });
  },
  /** Multi-select delete (bulk-action dock, 2026-07-21). */
  bulkDeleteEquipment(ids: string[]): Promise<{ deleted: number }> {
    return apiFetch("/inventory/equipment/bulk-delete", { method: "POST", body: { ids } });
  },
};
