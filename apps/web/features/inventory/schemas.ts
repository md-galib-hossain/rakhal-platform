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
  unit: z.string().trim().min(1),
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

/** Mirrors `CreateForageDto`/`UpdateForageDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/{create,update}-forage.dto.ts`) — one shape
 * for both create and edit, unlike medicine there's no separate adjust-stock endpoint so
 * `currentStock` is a normal editable field in both modes. */
export const forageFormSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["ROUGHAGE", "CONCENTRATE", "SILAGE", "SUPPLEMENT", "BY_PRODUCT", "MINERAL", "OTHER"]),
  category: z.string().trim().optional(),
  unit: z.string().trim().min(1),
  kgPerUnit: z.number().min(0).optional(),
  currentStock: z.number().min(0),
  costPerUnit: z.number().min(0),
  lowStockThreshold: z.number().min(0).optional(),
  moisturePct: z.number().min(0).max(100).optional(),
  supplier: z.string().trim().optional(),
  purchaseDate: z.string().min(1),
  notes: z.string().trim().optional(),
});
export type ForageFormInput = z.infer<typeof forageFormSchema>;
