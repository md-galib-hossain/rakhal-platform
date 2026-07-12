"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AdjustMedicineStockPayload,
  CreateMedicinePayload,
  Medicine,
  MedicineListFilters,
  MediaUrls,
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
};
