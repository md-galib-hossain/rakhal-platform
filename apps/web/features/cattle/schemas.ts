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

/**
 * Mirrors `UpdateCattleStatusDto` (`PATCH /cattle/:id/status`, PRD §8.1, RAKHAL-291 + follow-up).
 * `lactationStartDate` is only required by the backend when `productionStatus: "MILKING"` is set on a cow
 * with no active lactation (`lactationStage === null`) — that condition depends on the cow's own data, not
 * on anything in this form's state, so it's deliberately left optional here; `cattle-status-dialog.tsx`'s
 * submit handler checks the condition (it has the cow's `lactationStage`) and blocks submission with a
 * field-level error via `form.setError` before calling the mutation, rather than encoding external cow
 * state into this schema. `priorCalvings` follows the exact same reasoning: the backend rejects
 * `productionStatus: MILKING` on a heifer (`totalCalvings: 0`) unless `priorCalvings >= 1` is supplied —
 * that's also external cow data (`animalCategory === "HEIFER"`), so it stays a plain optional number here
 * and the dialog's submit handler guards it the same way.
 */
export const cattleStatusSchema = z.object({
  productionStatus: z.enum(["MILKING", "DRY"]).optional(),
  reproductiveStatus: z
    .enum(["NOT_ELIGIBLE", "POSTPARTUM_WAITING", "OPEN", "BRED_AWAITING_CONFIRMATION", "PREGNANT"])
    .optional(),
  /** `YYYY-MM-DD` (`type="date"` input value). Creates a `Lactation` row (`startReason: PURCHASE_IMPORT`)
   * server-side when supplied. */
  lactationStartDate: z.string().optional(),
  /** Integer >= 1. Required by the backend when marking a heifer (`totalCalvings: 0`) as MILKING —
   * signals she calved outside this system (e.g. purchased already-calved). */
  priorCalvings: z.number().int().min(1).optional(),
});
export type CattleStatusInput = z.infer<typeof cattleStatusSchema>;

/** Mirrors `ArchiveCattleDto` (`DELETE /cattle/:id`) — `sold`/`deceased` keep production status
 * distinct (CAT-09), `archived` is a plain archive. */
export const cattleArchiveSchema = z.object({
  reason: z.enum(["sold", "deceased", "archived"]),
  notes: z.string().trim().optional(),
});
export type CattleArchiveInput = z.infer<typeof cattleArchiveSchema>;

/** Mirrors `RecordBcsDto` (`POST /cattle/:id/bcs`, PRD §8.6) — score is one of 17 quarter-steps. */
export const recordBcsSchema = z.object({
  score: z.number().min(1).max(5),
  date: z.string().min(1).optional(),
  notes: z.string().trim().optional(),
});
export type RecordBcsInput = z.infer<typeof recordBcsSchema>;

/** Mirrors `RecordWeightDto` (`POST /cattle/:id/weight`). `date` is a `datetime-local` input value
 * (`YYYY-MM-DDTHH:mm`) — optional, left blank means "record as now" (backend already defaults to
 * `new Date()` when `date` is absent). */
export const recordWeightSchema = z.object({
  weightKg: z.number().min(10).max(2000),
  date: z.string().optional(),
  notes: z.string().trim().optional(),
});
export type RecordWeightInput = z.infer<typeof recordWeightSchema>;
