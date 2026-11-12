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
  shedId: z.string().optional(),
  animalGroupId: z.string().optional(),
  motherId: z.string().optional(),
  fatherId: z.string().optional(),
  sourceType: z.enum(["BORN", "PURCHASED", "GIFTED", "UNKNOWN"]).optional(),
  weightKg: z.number().min(0).max(2000).optional(),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CattleFormInput = z.infer<typeof cattleFormSchema>;

/** Edit-mode form schema — identical to create now: status and reproduction changes are events (`POST /cattle/:id/events`), not profile fields. */
export const cattleEditFormSchema = cattleFormSchema;
export type CattleEditFormInput = z.infer<typeof cattleEditFormSchema>;

/** RAKHAL-402 — real soft-delete only (`DELETE /cattle/:id`, backend refuses with a real-history
 * `ConflictException` for any animal with milk logs/health cases/breeding events). Split out from
 * the old combined `cattleArchiveSchema`/`CattleArchiveDialog` — Sold/Culled/Deceased are now a
 * disposition (`cattleDisposeSchema` below), not a delete reason. Sent as `reason: "archived"`
 * (still the only value `ArchiveCattleDto` accepts for a plain delete) — see `api.ts#deleteCattle`. */
export const cattleDeleteSchema = z.object({
  notes: z.string().trim().optional(),
});
export type CattleDeleteInput = z.infer<typeof cattleDeleteSchema>;

/** Mirrors `DisposeCattleDto` (`POST /cattle/:id/dispose`, RAKHAL-399/402) — Cull/Death only. Sold
 * goes through the existing `RecordSaleTrigger`/`RecordSaleDialog` (`features/sales`) instead,
 * since a sale needs a price/buyer/payment this plain disposition record doesn't carry. */
export const cattleDisposeSchema = z.object({
  type: z.enum(["CULL", "DEATH"]),
  date: z.string().min(1),
  reason: z.string().trim().optional(),
});
export type CattleDisposeInput = z.infer<typeof cattleDisposeSchema>;

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

/** Weigh / body-condition forms; both are sent as `POST /cattle/:id/events` (types WEIGHT, BCS). Score is one of 17 quarter-steps. */
export const recordBcsSchema = z.object({
  score: z.number().min(1).max(5),
  date: z.string().min(1).optional(),
  notes: z.string().trim().optional(),
});
export type RecordBcsInput = z.infer<typeof recordBcsSchema>;

/** `date` is a `datetime-local` input value (`YYYY-MM-DDTHH:mm`) — optional, left blank means "record as now". */
export const recordWeightSchema = z.object({
  weightKg: z.number().min(10).max(2000),
  date: z.string().optional(),
  notes: z.string().trim().optional(),
});
export type RecordWeightInput = z.infer<typeof recordWeightSchema>;

/** RAKHAL-452 — mirrors `CreateAnimalGroupDto`/`UpdateAnimalGroupDto`. */
export const animalGroupFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).optional(),
});
export type AnimalGroupFormInput = z.infer<typeof animalGroupFormSchema>;

