/**
 * RAKHAL-390 (MILESTONE 22) — Suppliers module read model. Mirrors `SupplierListRow`/
 * `SupplierSummary` (`purchasing/application/supplier-read.service.ts`, RAKHAL-373) directly.
 * Money fields are Decimal-as-string. Distinct from `features/settings/types.ts#Supplier` (the
 * CRUD write shape, reused as-is for create/edit — see `supplier-form-dialog.tsx`).
 */
export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  totalPurchases: string;
  payable: string;
  lastPurchaseAt: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface SupplierSummary {
  totalCount: number;
  activeCount: number;
  totalPurchases: string;
  totalPayable: string;
}
