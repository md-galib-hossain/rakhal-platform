import { z } from "zod";

/** Mirrors `CreateMedicineDto`/`UpdateMedicineDto` (verified live against
 * `rakhal-backend/src/modules/inventory/presentation/dto/{create,update}-medicine.dto.ts`) — one
 * shape for both create and edit. `currentStock` is create-only on the wire (edits go through the
 * separate `adjust-stock` endpoint per INV-02) but stays in the form so the create flow can collect
 * it; `toPayload` in the dialog strips it for updates. */
export const medicineFormSchema = z.object({
  name: z.string().trim().min(1),
  imageUrl: z.string().trim().optional(),
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
