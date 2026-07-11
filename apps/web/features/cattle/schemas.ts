import { z } from "zod";

/**
 * Mirrors the backend's `CreateCattleDto`/`UpdateCattleDto` (`create-cattle.dto.ts` /
 * `update-cattle.dto.ts`, verified live via Swagger) — one shape for both create and edit, since
 * the backend's `UpdateCattleDto` is `Partial<CreateCattleDto>`. Optional select/picker fields
 * use `""` as the RHF/Radix "unset" sentinel (Radix `Select.Item` can't take an empty-string
 * value) — stripped back to `undefined` in the submit handler before hitting the API, never sent
 * to the backend as a literal empty string.
 */
export const cattleFormSchema = z.object({
  name: z.string().trim().optional(),
  tagNumber: z.string().trim().min(1),
  breedId: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "CASTRATED_MALE"]),
  dateOfBirth: z.string().optional(),
  purpose: z.enum(["MILK", "BREEDING", "MEAT", "CALF", "BULL_SERVICE", "DUAL_PURPOSE"]),
  shedId: z.string().optional(),
  feedGroupId: z.string().optional(),
  motherId: z.string().optional(),
  fatherId: z.string().optional(),
  sourceType: z.enum(["BORN", "PURCHASED", "GIFTED", "UNKNOWN"]).optional(),
  weightKg: z.number().min(0).max(2000).optional(),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CattleFormInput = z.infer<typeof cattleFormSchema>;

/** Mirrors `UpdateCattleStatusDto` (`PATCH /cattle/:id/status`, PRD §8.1). */
export const cattleStatusSchema = z.object({
  productionStatus: z.enum(["MILKING", "DRY", "FRESH", "GROWING", "SOLD", "DECEASED"]).optional(),
  reproductiveStatus: z
    .enum(["HEIFER", "OPEN", "BRED", "PREGNANT", "DRY", "LACTATING", "POSTPARTUM", "ABORTED", "RETIRED"])
    .optional(),
});
export type CattleStatusInput = z.infer<typeof cattleStatusSchema>;

/** Mirrors `ArchiveCattleDto` (`DELETE /cattle/:id`) — `sold`/`deceased` keep production status
 * distinct (CAT-09), `archived` is a plain archive. */
export const cattleArchiveSchema = z.object({
  reason: z.enum(["sold", "deceased", "archived"]),
  notes: z.string().trim().optional(),
});
export type CattleArchiveInput = z.infer<typeof cattleArchiveSchema>;
