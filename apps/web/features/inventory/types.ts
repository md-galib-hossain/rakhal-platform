/**
 * Mirrors `rakhal-backend/src/modules/inventory/` directly — Medicine, Feed, Semen, Milk, and
 * Others (equipment) tabs are fully built and verified against the real backend.
 *
 * **Feed** (`feed_taxonomy_unification`) is one tab with two views, since feed is the umbrella
 * term — forage/concentrate/mineral/vitamin/additive are all feed, distinguished by `FeedClass`,
 * not separate top-level categories. **Purchased** is this module's own `FeedItem` CRUD (below).
 * **Prepared** reuses `src/modules/feed/`'s `FeedStock` model/`GET /feed/stock` endpoint (owned by
 * the Feed module, not `src/modules/inventory/`), read-only, no CRUD of its own — the only way
 * stock is produced/consumed is Finalize/"Feed Today" on the Feed Formulator page.
 * `FeedStockView` (`feed-stock-view.tsx`) cross-imports `features/feed`'s hooks, same established
 * pattern as `features/feed/components/log-distribution-dialog.tsx` cross-importing this module's
 * `useMilkTanks()`.
 */

/** `GET/POST /inventory/units` row shape (`unit.service.ts`, RAKHAL-326) — system-seeded
 * (`farmId: null`, visible to every farm) or farm-custom (`farmId` set, this farm only) unit
 * catalog entry. Embedded verbatim (not trimmed to `{id,name,symbol}`) on Medicine/FeedItem/
 * Equipment's `unit` relation — confirmed live: `medicine.service.ts`/`equipment.service.ts`/
 * `feed-item.service.ts` all use `include: { unit: true }`, the full Prisma `Unit` row. */
export type UnitDimension = "WEIGHT" | "VOLUME" | "COUNT";

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  dimension: UnitDimension;
  /** Conversion to this dimension's base unit (kg for WEIGHT, L for VOLUME). Null for COUNT. */
  conversionToBase: number | null;
  isSystemDefault: boolean;
  isActive: boolean;
  farmId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnitListFilters {
  dimension?: UnitDimension;
  includeArchived?: boolean;
}

/** `POST /inventory/units` body (`CreateUnitDto`) — a farm's own custom unit, used only when the
 * seeded system catalog doesn't already cover it. `farmId` comes from the token, never in the body. */
export interface CreateUnitPayload {
  name: string;
  symbol: string;
  dimension: UnitDimension;
  conversionToBase?: number;
}

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
  unit: Unit;
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
  unitId: string;
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
 * Feed tab, "Purchased" view — mirrors `feed-item.controller.ts`/`feed-item.service.ts` + the
 * `FeedItem` Prisma model directly (`@@map("Forage")` — same table, model renamed at the
 * `feed_taxonomy_unification` migration since feed is the umbrella term, not forage; forage is one
 * `FeedClass` alongside concentrate/mineral/vitamin/additive). `ingredientId` links a purchased
 * stock row to its Feed Formulator nutrition/price catalogue counterpart (`FeedIngredient`) — a
 * real FK, replacing the lowercased-name match the app used to rely on for stock decrement/price
 * sync. **Real difference from Medicine, not an oversight**: no `imageUrl`/photo column at all (no
 * photo route either) — the Figma "Add Forage" mock's photo dropzone and the card/detail images
 * have no backing field, so the frontend renders the same tinted-icon fallback every Medicine row
 * without a photo already uses, never an upload control. Also no `expiryDate`/withdrawal-day
 * fields (feed doesn't spoil like medicine) and no separate audited `adjust-stock` endpoint —
 * `currentStock` is a normal editable field on `PATCH /inventory/feed-items/:id`.
 */
export type FeedClass = "FORAGE" | "CONCENTRATE" | "MINERAL" | "VITAMIN" | "ADDITIVE" | "OTHER";
export type FeedSubType =
  | "GREEN_FODDER"
  | "ROUGHAGE"
  | "SILAGE"
  | "HAY"
  | "STRAW"
  | "GRAIN"
  | "OILCAKE"
  | "BY_PRODUCT"
  | "COMPOUND_PELLET"
  | "PREMIX"
  | "SUPPLEMENT"
  | "OTHER";
export type FeedItemStockStatus = "out" | "low" | "adequate";

/** `GET/POST /inventory/feed-items(/:id)` row shape (`feed-item.service.ts#present`). */
export interface FeedItem {
  id: string;
  name: string;
  feedClass: FeedClass;
  feedSubType: FeedSubType | null;
  category: string | null;
  ingredientId: string | null;
  unit: Unit;
  kgPerUnit: number | null;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold: number;
  moisturePct: number | null;
  supplier: string | null;
  purchaseDate: string;
  notes: string | null;
  isActive: boolean;
  stockStatus: FeedItemStockStatus;
  /** `currentStock * kgPerUnit`, or `null` when `kgPerUnit` isn't set. Derived, not stored. */
  kgEquivalent: number | null;
}

export interface FeedItemListFilters {
  search?: string;
  feedClass?: FeedClass;
}

/** `POST /inventory/feed-items` body (`CreateFeedItemDto`). `ingredientId` is required — every new
 * purchased feed item must link to a Feed Formulator catalogue/custom ingredient. */
export interface CreateFeedItemPayload {
  name: string;
  feedClass: FeedClass;
  feedSubType?: FeedSubType;
  category?: string;
  ingredientId: string;
  unitId: string;
  kgPerUnit?: number;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold?: number;
  moisturePct?: number;
  supplier?: string;
  purchaseDate: string;
  notes?: string;
}

/** `PATCH /inventory/feed-items/:id` body (`UpdateFeedItemDto`) — every field optional, including
 * `currentStock` (no separate adjust-stock endpoint for feed items, unlike medicine). */
export type UpdateFeedItemPayload = Partial<CreateFeedItemPayload>;

export type InventoryTabKey = "medicine" | "semen" | "milk" | "feed" | "others";

export interface InventoryTabConfig {
  key: InventoryTabKey;
  /** Whether this tab has a real, wired-up list/CRUD flow yet. */
  implemented: boolean;
}

export const INVENTORY_TABS: InventoryTabConfig[] = [
  { key: "medicine", implemented: true },
  { key: "semen", implemented: true },
  { key: "milk", implemented: true },
  { key: "feed", implemented: true },
  { key: "others", implemented: true },
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

/**
 * Semen tab — mirrors `semen.controller.ts`/`semen.service.ts` + the `SemenTank`/`SemenBatch`
 * Prisma models directly (verified live, `prisma/schemas/inventory/semen.prisma`, Figma
 * "Inventory - Semen" 732:20158 + "Add New Tank" 732:21955 + "Tank Details" 732:22640 + "Add Straw"
 * 732:23249). An LN2 tank holds straw batches; a batch's `strawQuantity` is the only real per-batch
 * stock count (INV-02: never negative) and a tank's own "straw in stock" is a *derived* sum across
 * its batches (`semen.service.ts#listTanks` groups by `tankId`) — the tank itself has no stock field.
 * **Real gaps vs the Figma mock, flagged not faked**: the "Add New Tank" mock pictures a "Straw in
 * Stock" input, but `CreateSemenTankDto` has no such field at all (a brand-new tank starts with zero
 * batches) — omitted from the create/edit form entirely rather than rendered as a fake input; the
 * derived total is shown instead on the read-only "Tank Details" view. The "Tank Details" mock's
 * "Adjust Straw Stock" section reads as a tank-level stock edit, but stock is batch-owned with no
 * matching tank-level endpoint — repurposed into a real "Update Readings" quick-form for the two
 * fields that genuinely are tank-owned and get checked often (`currentTempC`/`ln2LevelPct` via
 * `UpdateSemenTankDto`), not a fabricated stock adjustment. The "Add Straw" mock has no batch-name
 * field even though `CreateSemenBatchDto.name` is required — added a "Batch/Straw Name" input beyond
 * the mock so the form can actually submit (same precedent as Cattle's mock-gap "Additional Info"
 * band). "Breed"/"Straw Color" render as free text/a suggested-values select respectively — both are
 * plain `string` columns on the wire, not FK/enum, unlike Cattle's own `breedId` relation. A tank's
 * "Stable"/"Need Refill" status chip and progress-bar tint are a derived heuristic
 * (`strawInStock / strawCapacity < 20%` ⇒ "Need Refill"), not a stored field — `SemenTank` has no
 * status column of its own.
 */
export type SemenTankStatus = "stable" | "needsRefill";

/** `GET/POST /inventory/semen/tanks(/:id)` row shape (`semen.service.ts#presentTank`) — the raw
 * Prisma `SemenTank` row plus derived `strawInStock`/`availableCapacity` (batch-sum, not stored). */
export interface SemenTank {
  id: string;
  name: string;
  modelManufacturer: string | null;
  strawCapacity: number;
  numCanisters: number | null;
  numCanes: number | null;
  numGoblets: number | null;
  storageLocation: string | null;
  currentTempC: number | null;
  ln2LevelPct: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  strawInStock: number;
  availableCapacity: number;
}

/** `POST /inventory/semen/tanks` body (`CreateSemenTankDto`). No stock field — see doc comment above. */
export interface CreateSemenTankPayload {
  name: string;
  modelManufacturer?: string;
  strawCapacity: number;
  numCanisters?: number;
  numCanes?: number;
  numGoblets?: number;
  storageLocation?: string;
  /** Must be below 0 °C (INV-07), enforced server-side. */
  currentTempC?: number;
  ln2LevelPct?: number;
}

/** `PATCH /inventory/semen/tanks/:id` body (`UpdateSemenTankDto`) — same shape, all optional. */
export type UpdateSemenTankPayload = Partial<CreateSemenTankPayload>;

/** `GET/POST /inventory/semen/batches(/:id)` row shape (`semen.service.ts#presentBatch`) — the raw
 * Prisma `SemenBatch` row plus a derived `lowStraw` flag (`strawQuantity <= lowStrawThreshold`). */
export interface SemenBatch {
  id: string;
  name: string;
  batchCode: string | null;
  bullId: string | null;
  breed: string | null;
  strawColor: string | null;
  initialVitalityPct: number | null;
  strawQuantity: number;
  lowStrawThreshold: number;
  fatherId: string | null;
  motherId: string | null;
  tankId: string | null;
  canister: string | null;
  cane: string | null;
  goblet: string | null;
  notes: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lowStraw: boolean;
}

export interface SemenBatchListFilters {
  search?: string;
  tankId?: string;
  includeArchived?: boolean;
}

/** `POST /inventory/semen/batches` body (`CreateSemenBatchDto`). */
export interface CreateSemenBatchPayload {
  name: string;
  batchCode?: string;
  bullId?: string;
  breed?: string;
  strawColor?: string;
  initialVitalityPct?: number;
  strawQuantity: number;
  lowStrawThreshold?: number;
  fatherId?: string;
  motherId?: string;
  tankId?: string;
  canister?: string;
  cane?: string;
  goblet?: string;
  notes?: string;
}

/** `PATCH /inventory/semen/batches/:id` body (`UpdateSemenBatchDto`) — same shape, all optional. */
export type UpdateSemenBatchPayload = Partial<CreateSemenBatchPayload>;

export type EquipmentType = "EQUIPMENT" | "MACHINERY" | "TOOL" | "SUPPLY" | "OTHER";

/** `GET/POST /inventory/equipment(/:id)` row shape (`equipment.service.ts#present`) — the raw
 * Prisma `Equipment` row plus a derived `stockStatus` (reuses `domain/medicine-status.ts`, same as
 * Medicine — no separate "equipment status" logic on the backend). No `imageUrl`, no `expiryDate`,
 * no `batchId`, no location/warranty fields — see `equipment.prisma`. */
export interface Equipment {
  id: string;
  name: string;
  assetId: string | null;
  type: EquipmentType;
  unit: Unit | null;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold: number;
  purchaseDate: string;
  notes: string | null;
  isActive: boolean;
  stockStatus: MedicineStockStatus;
}

export interface EquipmentListFilters {
  search?: string;
  type?: EquipmentType;
}

/** `POST /inventory/equipment` body (`CreateEquipmentDto`). */
export interface CreateEquipmentPayload {
  name: string;
  assetId?: string;
  type?: EquipmentType;
  unitId?: string;
  currentStock: number;
  costPerUnit: number;
  lowStockThreshold?: number;
  purchaseDate: string;
  notes?: string;
}

/** `PATCH /inventory/equipment/:id` body (`UpdateEquipmentDto`) — same shape, all optional, incl.
 * `currentStock` (equipment has no separate audited adjust-stock route, unlike Medicine). */
export type UpdateEquipmentPayload = Partial<CreateEquipmentPayload>;
