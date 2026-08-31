"use client";

import { apiFetch } from "@/lib/api/client";
import type { SupplierRow, SupplierSummary } from "./types";

/** RAKHAL-390 (MILESTONE 22) — `GET /purchasing/suppliers`/`.../summary` (RAKHAL-373, read-only,
 * `purchasing.read`). Un-paginated (a farm's supplier directory is a small, bounded list — same
 * precedent `settingsApi.listSuppliers` already established). */
export const suppliersApi = {
  list(): Promise<SupplierRow[]> {
    return apiFetch<SupplierRow[]>("/purchasing/suppliers");
  },
  summary(): Promise<SupplierSummary> {
    return apiFetch<SupplierSummary>("/purchasing/suppliers/summary");
  },
};
