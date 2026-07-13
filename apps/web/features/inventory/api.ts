"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AdjustMedicineStockPayload,
  AdjustMilkTankVolumePayload,
  CreateForagePayload,
  CreateMedicinePayload,
  CreateMilkTankPayload,
  Forage,
  ForageListFilters,
  Medicine,
  MedicineListFilters,
  MediaUrls,
  MilkTank,
  MilkTankAuditLogEntry,
  MilkTankListFilters,
  MilkTankShed,
  MilkTankTeamMember,
  UpdateForagePayload,
  UpdateMedicinePayload,
  UpdateMilkTankPayload,
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

  /** `/inventory/forages*` — real backend routes (`forage.controller.ts`). No photo endpoints
   * (see `types.ts#Forage` doc comment) and no separate adjust-stock route — `currentStock` goes
   * through the normal update call. */
  listForages(filters: ForageListFilters, cursor?: string): Promise<CursorPage<Forage>> {
    return apiFetchPage<Forage>("/inventory/forages", {
      searchParams: { search: filters.search, type: filters.type, cursor, limit: 20 },
    });
  },
  findForage(id: string): Promise<Forage> {
    return apiFetch<Forage>(`/inventory/forages/${id}`);
  },
  createForage(dto: CreateForagePayload): Promise<Forage> {
    return apiFetch<Forage>("/inventory/forages", { method: "POST", body: dto });
  },
  updateForage(id: string, dto: UpdateForagePayload): Promise<Forage> {
    return apiFetch<Forage>(`/inventory/forages/${id}`, { method: "PATCH", body: dto });
  },
  archiveForage(id: string): Promise<Forage> {
    return apiFetch<Forage>(`/inventory/forages/${id}/archive`, { method: "PATCH" });
  },
  restoreForage(id: string): Promise<Forage> {
    return apiFetch<Forage>(`/inventory/forages/${id}/restore`, { method: "PATCH" });
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
};
