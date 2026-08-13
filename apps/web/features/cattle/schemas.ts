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
  /** RAKHAL-297: only meaningful when `gender === "FEMALE"` — e.g. a purchased already-calved cow,
   * so the backend's `deriveAnimalCategory()` correctly lands her as `COW` not `HEIFER` on create.
   * Same field/validation as `cattleStatusSchema.priorCalvings` above; kept separate rather than
   * shared since this schema's field is create-time-only and this one has no analogous
   * `needsPriorCalvings` external-state gate — it's just always offered for a female. */
  priorCalvings: z.number().int().min(1).optional(),
  /** RAKHAL-319-F — create-mode-only intake declarations, mirror `IntakeBreedingDto`/`IntakeHeatDto`
   * (`create-cattle.dto.ts`'s `intakeBreeding`/`intakeHeat`). `intakeReproductionMode` is local UI
   * state (which of the two mutually-exclusive sections is open), not sent to the backend itself —
   * `cattle-form-dialog.tsx`'s submit handler builds the nested payload from it, same reasoning as
   * `cattleStatusSchema`'s `needsLactationStartDate` pattern (external/local UI state, not encoded
   * as a `.superRefine()`, since no `superRefine` precedent exists elsewhere in this codebase). */
  intakeReproductionMode: z.enum(["none", "bred", "heat"]).optional(),
  intakeBreedingDate: z.string().optional(),
  intakeBreedingMethod: z.enum(["AI", "NATURAL", "EMBRYO_TRANSFER"]).optional(),
  intakeBreedingNotes: z.string().trim().optional(),
  intakeHeatDateTime: z.string().optional(),
  intakeHeatNotes: z.string().trim().optional(),
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

/**
 * RAKHAL-296-F — mirrors the backend's `CreatePurchasedLactationDto`
 * (`POST /reproduction/cattle/:id/purchased-lactation`, RAKHAL-281). Every field is optional — a
 * farmer marking a purchased cow as already-milking may know none, some, or all of these; whatever
 * is omitted is stored as `null` server-side and the resulting `Lactation` is always
 * `isEstimated: true`. This is the alternative to `cattleStatusSchema`'s exact `lactationStartDate`
 * path in `cattle-status-dialog.tsx` — offered when the farmer doesn't know the precise date.
 */
export const purchasedLactationSchema = z.object({
  estimatedCalvingDate: z.string().optional(),
  estimatedDaysInMilk: z.number().int().min(0).optional(),
  estimatedLactationNumber: z.number().int().min(1).optional(),
});
export type PurchasedLactationInput = z.infer<typeof purchasedLactationSchema>;

/** `cattle-status-dialog.tsx` runs one `useForm` covering both the exact-date MILKING path
 * (`cattleStatusSchema`) and the estimated-intake path (`purchasedLactationSchema`) — merged so
 * both sets of fields type-check together under a single resolver rather than juggling two forms
 * in one dialog. Which path's fields actually get submitted is decided at submit time by the
 * dialog's own "estimated intake" toggle, not by this schema. */
export const cattleStatusWithEstimatedIntakeSchema = cattleStatusSchema.merge(purchasedLactationSchema);
export type CattleStatusWithEstimatedIntakeInput = z.infer<typeof cattleStatusWithEstimatedIntakeSchema>;

/** Edit-mode form schema — `cattleFormSchema` (basic info) extended with the former status
 * dialog's own fields, folding "change status" into the Edit Animal modal instead of a separate
 * dialog/route. Create mode still resolves against plain `cattleFormSchema` (status fields make no
 * sense before the animal exists). The status schema's own `priorCalvings` (confirms a heifer
 * already calved outside this system, unblocks a MILKING status change) is renamed
 * `statusPriorCalvings` here — `cattleFormSchema` already has an unrelated `priorCalvings` (create
 * intake: lands a purchased already-calved cow as `COW` not `HEIFER`), and both are shown on the
 * same edit form, so they can't share one field name. */
export const cattleEditFormSchema = cattleFormSchema.extend({
  productionStatus: cattleStatusSchema.shape.productionStatus,
  reproductiveStatus: cattleStatusSchema.shape.reproductiveStatus,
  lactationStartDate: cattleStatusSchema.shape.lactationStartDate,
  statusPriorCalvings: cattleStatusSchema.shape.priorCalvings,
  estimatedCalvingDate: purchasedLactationSchema.shape.estimatedCalvingDate,
  estimatedDaysInMilk: purchasedLactationSchema.shape.estimatedDaysInMilk,
  estimatedLactationNumber: purchasedLactationSchema.shape.estimatedLactationNumber,
});
export type CattleEditFormInput = z.infer<typeof cattleEditFormSchema>;

/** Mirrors `ArchiveCattleDto` (`DELETE /cattle/:id`) — `sold`/`deceased`/`culled` keep production
 * status distinct (CAT-09), `archived` is a plain archive. */
export const cattleArchiveSchema = z.object({
  reason: z.enum(["sold", "deceased", "culled", "archived"]),
  notes: z.string().trim().optional(),
});
export type CattleArchiveInput = z.infer<typeof cattleArchiveSchema>;

/** Mirrors `CreateAnimalHoldDto` (`POST /cattle/:cattleId/holds`, RAKHAL-280). */
export const createAnimalHoldSchema = z.object({
  type: z.enum(["REPRODUCTIVE", "MILK_DISCARD", "QUARANTINE", "OTHER"]),
  reason: z.string().trim().min(2).max(500),
});
export type CreateAnimalHoldInput = z.infer<typeof createAnimalHoldSchema>;

/** Mirrors `ReleaseAnimalHoldDto` (`PATCH /cattle/:cattleId/holds/:holdId/release`). */
export const releaseAnimalHoldSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type ReleaseAnimalHoldInput = z.infer<typeof releaseAnimalHoldSchema>;

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
