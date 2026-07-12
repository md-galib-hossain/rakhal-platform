/**
 * Mirrors `rakhal-backend/src/modules/inventory/` directly — the "Medicine" tab
 * (`medicine.controller.ts`/`medicine.service.ts`, `Medicine` Prisma model + `MedicineType`/
 * `MedicineCategory` enums) is fully built and verified against the real backend; `Forage`/`Semen`/
 * `Milk`/`Others` (equipment) have real backend controllers too (`forage.controller.ts`,
 * `semen.controller.ts`, `milk-tank.controller.ts`, `equipment.controller.ts`) but aren't wired on
 * the frontend yet — deliberately not started this pass (only the 3 Figma frames given were for
 * Medicine), flagged via `INVENTORY_TABS`' `implemented` flag rather than faked.
 */

export type MedicineType = "LIQUID" | "POWDER" | "TABLET" | "INJECTABLE" | "BOLUS" | "OINTMENT" | "OTHER";
export type MedicineCategory =
  | "ANTIBIOTIC"
  | "ANTIPARASITIC"
  | "VACCINE"
  | "VITAMIN"
  | "MINERAL"
  | "HORMONE"
  | "ANTI_INFLAMMATORY"
  | "ANALGESIC"
  | "OTHER";
export type MedicineStockStatus = "out" | "low" | "adequate";
export type MedicineExpiryStatus = "expired" | "expiring_soon" | "ok";
export type MedicineListStatus = "active" | "expired" | "expiring_soon";
export type MedicineStockMovementReason = "PURCHASE" | "TREATMENT" | "ADJUSTMENT" | "EXPIRED_DISPOSED" | "CORRECTION";

/** `GET/POST /inventory/medicines(/:id)` row shape (`medicine.service.ts#present`) — the raw
 * Prisma `Medicine` row plus derived `stockStatus`/`expiryStatus` (pure functions in
 * `domain/medicine-status.ts`, not stored columns). */
export interface Medicine {
  id: string;
  name: string;
  imageUrl: string | null;
  type: MedicineType;
  category: MedicineCategory;
  manufacturer: string | null;
  batchId: string | null;
  unit: string;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold: number;
  purchaseDate: string;
  expiryDate: string;
  milkWithdrawalDays: number;
  meatWithdrawalDays: number;
  notes: string | null;
  isActive: boolean;
  stockStatus: MedicineStockStatus;
  expiryStatus: MedicineExpiryStatus;
}

export interface MedicineListFilters {
  search?: string;
  category?: MedicineCategory;
  status?: MedicineListStatus;
}

/** `POST /inventory/medicines` body (`CreateMedicineDto`). */
export interface CreateMedicinePayload {
  name: string;
  imageUrl?: string;
  type: MedicineType;
  category: MedicineCategory;
  manufacturer?: string;
  batchId?: string;
  unit: string;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold?: number;
  purchaseDate: string;
  expiryDate: string;
  milkWithdrawalDays?: number;
  meatWithdrawalDays?: number;
  notes?: string;
}

/** `PATCH /inventory/medicines/:id` body (`UpdateMedicineDto`) — stock is deliberately absent;
 * the backend only allows changing it via the audited `adjust-stock` endpoint (INV-02). */
export type UpdateMedicinePayload = Partial<Omit<CreateMedicinePayload, "currentStock">>;

/** `POST /inventory/medicines/:id/adjust-stock` body (`AdjustStockDto`) — signed delta. */
export interface AdjustMedicineStockPayload {
  adjustment: number;
  reason: MedicineStockMovementReason;
  notes?: string;
}

export type InventoryTabKey = "medicine" | "forage" | "semen" | "milk" | "others";

export interface InventoryTabConfig {
  key: InventoryTabKey;
  /** Whether this tab has a real, wired-up list/CRUD flow yet. */
  implemented: boolean;
}

export const INVENTORY_TABS: InventoryTabConfig[] = [
  { key: "medicine", implemented: true },
  { key: "forage", implemented: false },
  { key: "semen", implemented: false },
  { key: "milk", implemented: false },
  { key: "others", implemented: false },
];
