"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AdjustMedicineStockPayload,
  CreateForagePayload,
  CreateMedicinePayload,
  Forage,
  ForageListFilters,
  Medicine,
  MedicineListFilters,
  MediaUrls,
  UpdateForagePayload,
  UpdateMedicinePayload,
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
};
