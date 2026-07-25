import { z } from "zod";

/**
 * Mirrors the backend's reproduction create DTOs exactly (`create-heat-event.dto.ts`,
 * `create-breeding-event.dto.ts`, `create-pregnancy-diagnosis.dto.ts`, `create-calving-event.dto.ts`,
 * `create-abortion-event.dto.ts`, `protocol.dto.ts` — verified live via source, not the aspirational
 * API doc). Optional select/picker fields use `""` as the RHF/Radix "unset" sentinel, stripped back
 * to `undefined` in each dialog's submit handler before hitting the API.
 */

export const heatEventSchema = z.object({
  cattleId: z.string().min(1, "Select a cow"),
  heatDateTime: z.string().min(1),
  detectionMethod: z.enum(["VISUAL", "COLLAR_SENSOR", "PEDOMETER", "MANUAL"]),
  standingHeat: z.boolean().optional(),
  mucusDischarge: z.boolean().optional(),
  mountingBehavior: z.boolean().optional(),
  restlessness: z.boolean().optional(),
  notes: z.string().trim().optional(),
});
export type CreateHeatEventInput = z.infer<typeof heatEventSchema>;

export const breedingEventSchema = z.object({
  cattleId: z.string().min(1, "Select a cow"),
  breedingDate: z.string().min(1),
  breedingMethod: z.enum(["AI", "NATURAL", "EMBRYO_TRANSFER"]),
  bullId: z.string().optional(),
  semenBatchId: z.string().optional(),
  inseminator: z.string().trim().optional(),
  expectedPregnancyCheckDate: z.string().optional(),
  notes: z.string().trim().optional(),
});
export type CreateBreedingEventInput = z.infer<typeof breedingEventSchema>;

export const pregnancyDiagnosisSchema = z.object({
  cattleId: z.string().min(1, "Select a cow"),
  breedingEventId: z.string().optional(),
  diagnosisDate: z.string().min(1),
  result: z.enum(["PREGNANT", "NOT_PREGNANT", "SUSPECTED"]),
  diagnosisMethod: z.enum(["ULTRASOUND", "PALPATION", "LAB"]),
  gestationDay: z.number().min(0).optional(),
  expectedCalvingDate: z.string().optional(),
  notes: z.string().trim().optional(),
});
export type CreatePregnancyDiagnosisInput = z.infer<typeof pregnancyDiagnosisSchema>;

export const calfBirthSchema = z
  .object({
    gender: z.enum(["MALE", "FEMALE"]),
    tagNumber: z.string().trim().optional(),
    name: z.string().trim().optional(),
    birthWeight: z.number().min(0).optional(),
    status: z.enum(["ALIVE", "STILLBORN", "DIED_AFTER_BIRTH"]),
  })
  .refine((calf) => calf.status !== "ALIVE" || !!calf.tagNumber, {
    message: "Tag number is required for a live calf",
    path: ["tagNumber"],
  });

export const calvingEventSchema = z.object({
  cattleId: z.string().min(1, "Select a cow"),
  pregnancyId: z.string().optional(),
  calvingDate: z.string().min(1),
  calvingEase: z.enum(["NORMAL", "ASSISTED", "DIFFICULT", "CESAREAN"]),
  calfCount: z.number().min(1).optional(),
  placentaExpelled: z.boolean().optional(),
  retainedPlacenta: z.boolean().optional(),
  complications: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  calves: z.array(calfBirthSchema).optional(),
});
export type CreateCalvingEventInput = z.infer<typeof calvingEventSchema>;

export const abortionEventSchema = z.object({
  cattleId: z.string().min(1, "Select a cow"),
  pregnancyId: z.string().optional(),
  abortionDate: z.string().min(1),
  gestationDay: z.number().min(0).optional(),
  suspectedCause: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CreateAbortionEventInput = z.infer<typeof abortionEventSchema>;

/** Mirrors `ApplyProtocolDto` — `startDate` YYYY-MM-DD, defaults to today on the backend. */
export const applyProtocolSchema = z.object({
  protocolId: z.string().min(1, "Select a protocol"),
  cattleIds: z.array(z.string()).min(1, "Select at least one cow"),
  startDate: z.string().optional(),
});
export type ApplyProtocolInput = z.infer<typeof applyProtocolSchema>;

/** Mirrors `RecordAiDto`. */
export const recordProtocolAiSchema = z.object({
  semenBatchId: z.string().optional(),
  inseminator: z.string().trim().optional(),
  aiDate: z.string().optional(),
  notes: z.string().trim().optional(),
});
export type RecordProtocolAiInput = z.infer<typeof recordProtocolAiSchema>;

/** Mirrors `RecordOutcomeDto`. */
export const recordProtocolOutcomeSchema = z.object({
  outcome: z.enum(["PREGNANT", "OPEN", "PREGNANCY_LOSS"]),
  notes: z.string().trim().optional(),
});
export type RecordProtocolOutcomeInput = z.infer<typeof recordProtocolOutcomeSchema>;

/** Mirrors `CloseInstanceDto`. */
export const closeProtocolInstanceSchema = z.object({
  status: z.enum(["CANCELLED", "FAILED"]),
  reason: z.string().trim().optional(),
});
export type CloseProtocolInstanceInput = z.infer<typeof closeProtocolInstanceSchema>;
