import { z } from "zod";

/** Mirrors `CreateMedicineDto`/`UpdateMedicineDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/{create,update}-medicine.dto.ts`) — one
 * shape for both create and edit. `currentStock` is create-only on the wire (edits go through the
 * separate `adjust-stock` endpoint per INV-02) but stays in the form so the create flow can collect
 * it; `toPayload` in the dialog strips it for updates. The photo is staged/uploaded separately
 * (`POST /inventory/medicines/:id/photo`, same two-step contract as cattle photos) — not a form
 * field here. */
export const medicineFormSchema = z.object({
  name: z.string().trim().min(1),
  currentStock: z.number().min(0),
  unitId: z.string().min(1),
  costPerUnit: z.number().min(0),
  type: z.enum(["LIQUID", "POWDER", "TABLET", "INJECTABLE", "BOLUS", "OINTMENT", "OTHER"]),
  category: z.enum([
    "ANTIBIOTIC",
    "ANTIPARASITIC",
    "VACCINE",
    "VITAMIN",
    "MINERAL",
    "HORMONE",
    "ANTI_INFLAMMATORY",
    "ANALGESIC",
    "OTHER",
  ]),
  manufacturer: z.string().trim().optional(),
  purchaseDate: z.string().min(1),
  expiryDate: z.string().min(1),
  batchId: z.string().trim().optional(),
  lowStockThreshold: z.number().min(0).optional(),
  milkWithdrawalDays: z.number().min(0).optional(),
  meatWithdrawalDays: z.number().min(0).optional(),
  notes: z.string().trim().optional(),
});
export type MedicineFormInput = z.infer<typeof medicineFormSchema>;

/** Mirrors `CreateFeedItemDto`/`UpdateFeedItemDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/{create,update}-feed-item.dto.ts`) — one
 * shape for both create and edit, unlike medicine there's no separate adjust-stock endpoint so
 * `currentStock` is a normal editable field in both modes. `ingredientId` is required — every feed
 * item links to a Feed Formulator catalogue/custom ingredient (`feed_taxonomy_unification`). */
const optionalPct = z.number().min(0).max(100).nullable().optional();

/** Nutrition profile section (ADR-026): DM/CP/ME required, everything else optional (`null` = not
 * measured, never zero). Ranges mirror `NutritionInputDto` + the backend's ME plausibility band. */
export const nutritionFormSchema = z.object({
  dmPct: z.number().min(0).max(100),
  cpPct: z.number().min(0).max(100),
  meMjPerKgDm: z.number().min(0).max(40),
  fatPct: optionalPct,
  ndfPct: optionalPct,
  adfPct: optionalPct,
  rdpPct: optionalPct,
  rupPct: optionalPct,
  starchPct: optionalPct,
  sugarsPct: optionalPct,
  calciumPct: optionalPct,
  phosphorusPct: optionalPct,
  tdnPct: optionalPct,
  nutritionSource: z.enum(["REFERENCE", "MANUFACTURER", "LAB", "FARM_ESTIMATE"]).optional(),
  sourceRef: z.string().trim().optional(),
  note: z.string().trim().optional(),
});
export type NutritionFormInput = z.infer<typeof nutritionFormSchema>;

/** `ingredientId` is optional since MILESTONE 26 — a feed item carries its own nutrition profile;
 * the ingredient is only an optional "copy from catalogue" source and price-sync target. On create
 * the `nutrition` object is required (the section renders in create mode only; editing a lot's
 * nutrition happens per batch from the detail sheet), so it stays optional in the schema. */
export const feedItemFormSchema = z.object({
  name: z.string().trim().min(1),
  feedClass: z.enum(["FORAGE", "CONCENTRATE", "MINERAL", "VITAMIN", "ADDITIVE", "OTHER"]),
  feedSubType: z
    .enum(["GREEN_FODDER", "ROUGHAGE", "SILAGE", "HAY", "STRAW", "GRAIN", "OILCAKE", "BY_PRODUCT", "COMPOUND_PELLET", "PREMIX", "SUPPLEMENT", "OTHER"])
    .optional(),
  ingredientId: z.string().trim().optional(),
  nutrition: nutritionFormSchema.optional(),
  batchCode: z.string().trim().optional(),
  unitId: z.string().min(1),
  kgPerUnit: z.number().min(0).optional(),
  currentStock: z.number().min(0),
  costPerUnit: z.number().min(0),
  lowStockThreshold: z.number().min(0).optional(),
  supplier: z.string().trim().optional(),
  purchaseDate: z.string().min(1),
  notes: z.string().trim().optional(),
});
export type FeedItemFormInput = z.infer<typeof feedItemFormSchema>;

/** Restock ("Add batch") — mirrors `CreateFeedItemBatchDto`. Nutrition is handled separately (only
 * sent when this delivery differs from the item's default profile). */
export const feedItemBatchFormSchema = z.object({
  currentStock: z.number().gt(0),
  costPerUnit: z.number().min(0),
  purchaseDate: z.string().min(1),
  batchCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type FeedItemBatchFormInput = z.infer<typeof feedItemBatchFormSchema>;

/** Mirrors `CreateMilkTankDto`/`UpdateMilkTankDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/milk-tank.dto.ts`) — one shape for both
 * create and edit. `currentVolumeL` is create-only on the wire (edits go through the separate
 * audited `adjust-volume` endpoint) but stays in the form so the create flow can collect a starting
 * volume; `toPayload` in the dialog strips it for updates. No `coolingType` field — the Figma mock's
 * dropdown has no backing column (see `types.ts` doc comment), not part of this schema. */
export const milkTankFormSchema = z.object({
  name: z.string().trim().min(1),
  tankType: z.enum(["SELLABLE", "WITHHOLDING"]),
  totalCapacityL: z.number().min(0),
  currentVolumeL: z.number().min(0).optional(),
  fatPct: z.number().min(0).max(100).optional(),
  proteinPct: z.number().min(0).max(100).optional(),
  snfPct: z.number().min(0).max(100).optional(),
  smartSensorId: z.string().trim().optional(),
  targetTempC: z.number().optional(),
  agitationIntervalMin: z.number().int().min(0).optional(),
  assignedShedId: z.string().trim().optional(),
});
export type MilkTankFormInput = z.infer<typeof milkTankFormSchema>;

/** Figma "Sync Data to Physical" (734:31364) — not a real DTO of its own, resolves to
 * `AdjustMilkTankVolumePayload` (`activityType: "ADJUSTMENT"`, `delta` computed from the tank's
 * current volume vs the actual entered volume). The reason chips + free-text reason both feed
 * `notes` since the backend has a single `notes` field, not a separate reason-code enum. */
export const milkTankSyncFormSchema = z.object({
  actualVolumeL: z.number().min(0),
  fatPct: z.number().min(0).max(100).optional(),
  proteinPct: z.number().min(0).max(100).optional(),
  snfPct: z.number().min(0).max(100).optional(),
  reason: z.enum(["BUYERS_SLIP", "TYPING_ERROR", "UNKNOWN_LOSS", "OTHERS"]),
  notes: z.string().trim().optional(),
});
export type MilkTankSyncFormInput = z.infer<typeof milkTankSyncFormSchema>;

/** Mirrors `CreateSemenTankDto`/`UpdateSemenTankDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/semen-tank.dto.ts`) — one shape for both
 * create and edit. No stock field (see `types.ts` doc comment) — a tank's straw stock is always
 * derived from its batches. */
export const semenTankFormSchema = z.object({
  name: z.string().trim().min(1),
  modelManufacturer: z.string().trim().optional(),
  strawCapacity: z.number().int().min(1),
  numCanisters: z.number().int().min(0).optional(),
  numGoblets: z.number().int().min(0).optional(),
  storageLocation: z.string().trim().optional(),
});
export type SemenTankFormInput = z.infer<typeof semenTankFormSchema>;

/** Mirrors `CreateSemenBatchDto`/`UpdateSemenBatchDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/semen-batch.dto.ts`) — one shape for both
 * create and edit. Adds `name` (required on the wire) beyond the Figma "Add Straw" mock, which has no
 * matching input field — see `types.ts` doc comment. */
export const semenBatchFormSchema = z.object({
  name: z.string().trim().min(1),
  bullId: z.string().trim().optional(),
  breed: z.string().trim().optional(),
  batchCode: z.string().trim().optional(),
  strawColor: z.string().trim().optional(),
  initialVitalityPct: z.number().min(0).max(100),
  strawQuantity: z.number().int().min(0),
  costPerUnit: z.number().min(0),
  semenType: z.enum(["CONVENTIONAL", "SEX_SORTED"]).optional(),
  targetSex: z.enum(["FEMALE", "MALE"]).optional(),
  fatherId: z.string().trim().optional(),
  motherId: z.string().trim().optional(),
  tankId: z.string().trim().optional(),
  canister: z.string().trim().optional(),
  goblet: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/** Mirrors `CreateEquipmentDto`/`UpdateEquipmentDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/{create,update}-equipment.dto.ts`) — one
 * shape for both create and edit; `currentStock` stays editable in both modes (no separate
 * adjust-stock route, unlike Medicine). */
export const equipmentFormSchema = z.object({
  name: z.string().trim().min(1),
  assetId: z.string().trim().optional(),
  type: z.enum(["EQUIPMENT", "MACHINERY", "TOOL", "SUPPLY", "OTHER"]),
  unitId: z.string().min(1).optional(),
  currentStock: z.number().min(0),
  costPerUnit: z.number().min(0),
  lowStockThreshold: z.number().min(0).optional(),
  purchaseDate: z.string().min(1),
  notes: z.string().trim().optional(),
});
export type EquipmentFormInput = z.infer<typeof equipmentFormSchema>;
export type SemenBatchFormInput = z.infer<typeof semenBatchFormSchema>;
