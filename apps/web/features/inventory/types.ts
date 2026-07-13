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

/** Signed R2 URL bundle — same shape as `features/cattle/types.ts#MediaUrls` (kept feature-local
 * per this codebase's per-feature siloing convention, not cross-imported). */
export interface MediaUrls {
  asset_id: string;
  thumb_url: string;
  full_url: string | null;
  width: number | null;
  height: number | null;
  expires_at: string;
}

/**
 * Forage tab — mirrors `forage.controller.ts`/`forage.service.ts` + the `Forage` Prisma model
 * directly (verified live, `prisma/schemas/inventory/forage.prisma`). **Real difference from
 * Medicine, not an oversight**: `Forage` has no `imageUrl`/photo column at all (no
 * `POST/DELETE /inventory/forages/:id/photo` route either) — the Figma "Add Forage" mock's photo
 * dropzone and the card/detail images have no backing field, so the frontend renders the same
 * tinted-icon fallback every Medicine row without a photo already uses, never an upload control.
 * Also no `expiryDate`/withdrawal-day fields (forage doesn't spoil like medicine) and no separate
 * audited `adjust-stock` endpoint — `currentStock` is a normal editable field on `PATCH
 * /inventory/forages/:id`.
 */
export type ForageType = "ROUGHAGE" | "CONCENTRATE" | "SILAGE" | "SUPPLEMENT" | "BY_PRODUCT" | "MINERAL" | "OTHER";
export type ForageStockStatus = "out" | "low" | "adequate";

/** `GET/POST /inventory/forages(/:id)` row shape (`forage.service.ts#present`). */
export interface Forage {
  id: string;
  name: string;
  type: ForageType;
  category: string | null;
  unit: string;
  kgPerUnit: number | null;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold: number;
  moisturePct: number | null;
  supplier: string | null;
  purchaseDate: string;
  notes: string | null;
  isActive: boolean;
  stockStatus: ForageStockStatus;
  /** `currentStock * kgPerUnit`, or `null` when `kgPerUnit` isn't set. Derived, not stored. */
  kgEquivalent: number | null;
}

export interface ForageListFilters {
  search?: string;
  type?: ForageType;
}

/** `POST /inventory/forages` body (`CreateForageDto`). */
export interface CreateForagePayload {
  name: string;
  type: ForageType;
  category?: string;
  unit: string;
  kgPerUnit?: number;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold?: number;
  moisturePct?: number;
  supplier?: string;
  purchaseDate: string;
  notes?: string;
}

/** `PATCH /inventory/forages/:id` body (`UpdateForageDto`) — every field optional, including
 * `currentStock` (no separate adjust-stock endpoint for forage, unlike medicine). */
export type UpdateForagePayload = Partial<CreateForagePayload>;

export type InventoryTabKey = "medicine" | "forage" | "semen" | "milk" | "others";

export interface InventoryTabConfig {
  key: InventoryTabKey;
  /** Whether this tab has a real, wired-up list/CRUD flow yet. */
  implemented: boolean;
}

export const INVENTORY_TABS: InventoryTabConfig[] = [
  { key: "medicine", implemented: true },
  { key: "forage", implemented: true },
  { key: "semen", implemented: false },
  { key: "milk", implemented: true },
  { key: "others", implemented: false },
];

/**
 * Milk tab — mirrors `milk-tank.controller.ts`/`milk-tank.service.ts` + the `MilkTank`/
 * `MilkTankAuditLog` Prisma models directly (verified live, `prisma/schemas/inventory/milk-tank.prisma`,
 * Figma "Inventory - Milk" 734:27903 + "Add New Tank" 734:30564 + "Sync to Physical" 734:31364). A
 * farm keeps SELLABLE + WITHHOLDING tanks; volume changes go through the audited `adjust-volume`
 * endpoint (never a plain field edit) and append an immutable `MilkTankAuditLog` row.
 * **Real gaps vs the Figma mock, flagged not faked**: `CreateMilkTankDto`/`UpdateMilkTankDto` have no
 * `coolingType` field at all — the mock's "Cooling Type" dropdown ("Direct Expansion") has no backing
 * column, rendered as a disabled/decorative field in the form, never submitted. The mock's
 * "Statistics" KPIs ("Own Herd Production" vs "Outsourced Purchase" split, "Calf Feed
 * Pool"/"Today's Consumption") have zero backing data anywhere in this schema (no source-of-milk
 * tracking, no calf-feed-to-tank link) — not built as fakes; replaced with a real Sellable/Withholding
 * volume breakdown of the same `Total Milk Stock` KPI card instead (see `milk-stats-card.tsx`). The
 * mock's audit log "Loss" activity chip has no matching enum value — `MilkTankActivity` is
 * COLLECTION/SALE/ADJUSTMENT/TRANSFER/CALF_ALLOCATION, so ADJUSTMENT (used for manual sync
 * corrections) renders with the same rose "Loss"-style chip when its delta is negative.
 */
export type MilkTankType = "SELLABLE" | "WITHHOLDING";
export type MilkTankActivity = "COLLECTION" | "SALE" | "ADJUSTMENT" | "TRANSFER" | "CALF_ALLOCATION";

/** `GET/POST /inventory/milk-tanks(/:id)` row shape (`milk-tank.service.ts#present`) — the raw
 * Prisma `MilkTank` row plus a derived `fillPct` (not a stored column). */
export interface MilkTank {
  id: string;
  name: string;
  tankType: MilkTankType;
  totalCapacityL: number;
  currentVolumeL: number;
  fatPct: number | null;
  proteinPct: number | null;
  snfPct: number | null;
  smartSensorId: string | null;
  targetTempC: number | null;
  agitationIntervalMin: number | null;
  assignedShedId: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  fillPct: number;
}

export interface MilkTankListFilters {
  tankType?: MilkTankType;
  includeArchived?: boolean;
}

/** `POST /inventory/milk-tanks` body (`CreateMilkTankDto`). */
export interface CreateMilkTankPayload {
  name: string;
  tankType: MilkTankType;
  totalCapacityL: number;
  currentVolumeL?: number;
  fatPct?: number;
  proteinPct?: number;
  snfPct?: number;
  smartSensorId?: string;
  targetTempC?: number;
  agitationIntervalMin?: number;
  assignedShedId?: string;
}

/** `PATCH /inventory/milk-tanks/:id` body (`UpdateMilkTankDto`) — volume goes through adjust-volume. */
export type UpdateMilkTankPayload = Partial<Omit<CreateMilkTankPayload, "currentVolumeL">>;

/** `POST /inventory/milk-tanks/:id/adjust-volume` body (`AdjustMilkTankVolumeDto`) — signed delta,
 * writes an immutable `MilkTankAuditLog` row. Used by `MilkSyncDialog` ("Sync Data to Physical",
 * `activityType: "ADJUSTMENT"`, delta = actual − current). */
export interface AdjustMilkTankVolumePayload {
  delta: number;
  activityType: MilkTankActivity;
  source?: string;
  notes?: string;
}

/** `GET /inventory/milk-tanks/audit-log` row shape — cursor-paginated, append-only. */
export interface MilkTankAuditLogEntry {
  id: string;
  milkTankId: string;
  farmId: string;
  activityType: MilkTankActivity;
  quantityL: number;
  balanceAfterL: number;
  source: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

/** `GET /sheds` row shape (same `sheds.controller.ts` the cattle filters use) — kept feature-local
 * per this codebase's per-feature siloing convention (see `MediaUrls` above) rather than importing
 * `features/cattle/types`. */
export interface MilkTankShed {
  id: string;
  name: string;
  code: string;
}

/** `GET /settings/team` row shape (`team.service.ts#listTeam`, snake_case on the wire like the
 * cattle `highlights` endpoint) — used only to resolve the audit log's `createdBy` user id to a
 * display name/avatar; requires `team.read`, which a Worker role may not have. `useTeamMembersMap`
 * treats a failed fetch as "no names resolved" rather than blocking the page — see that hook. */
export interface MilkTankTeamMember {
  id: string;
  name: string;
}
