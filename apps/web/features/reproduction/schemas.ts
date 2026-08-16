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

/** Explicit semen provenance (no ticket #, 2026-08-15) — see `SemenSource` in `types.ts`. */
const semenSourceEnum = z.enum(["FARM_INVENTORY", "TECHNICIAN_SUPPLIED", "EXTERNAL"]);
const semenTypeEnum = z.enum(["CONVENTIONAL", "SEX_SORTED"]);
const targetSexEnum = z.enum(["FEMALE", "MALE"]);
/** RAKHAL-330: how a breeding/AI cost was paid — mirrors backend `FinancePaymentMethod`. */
const paymentMethodEnum = z.enum(["CASH", "BANK_TRANSFER", "MFS", "WALLET"]);

/** RAKHAL-330: shared cost-validation rule for both the create and edit breeding-event schemas —
 * AI sourced from anything other than farm inventory needs its own `serviceCost` (a farm-inventory
 * pick's cost comes from the selected batch, resolved server-side); `paymentMethod` becomes required
 * whenever a real cost is actually being submitted, so a cost never posts to Finance with no payment
 * source recorded. */
function withBreedingCostValidation<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.superRefine((data, ctx) => {
    const values = data as {
      breedingMethod?: string;
      semenSource?: string;
      serviceCost?: number;
      paymentMethod?: string;
    };
    const isAiFromManualSource =
      values.breedingMethod === "AI" && values.semenSource && values.semenSource !== "FARM_INVENTORY";
    if (isAiFromManualSource && (values.serviceCost === undefined || values.serviceCost === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serviceCost"],
        message: "Cost is required when semen is not from farm inventory",
      });
    }
    const costIsBeingSubmitted =
      (values.serviceCost !== undefined && values.serviceCost > 0) || values.semenSource === "FARM_INVENTORY";
    if (costIsBeingSubmitted && !values.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "Payment method is required when recording a cost",
      });
    }
  });
}

const breedingEventBaseSchema = z.object({
  cattleId: z.string().min(1, "Select a cow"),
  breedingDate: z.string().min(1),
  breedingMethod: z.enum(["AI", "NATURAL", "EMBRYO_TRANSFER"]),
  bullId: z.string().optional(),
  semenBatchId: z.string().optional(),
  inseminator: z.string().trim().optional(),
  semenSource: semenSourceEnum.optional(),
  serviceProviderId: z.string().optional(),
  sireNameOrCode: z.string().trim().optional(),
  sireBreed: z.string().trim().optional(),
  semenType: semenTypeEnum.optional(),
  targetSex: targetSexEnum.optional(),
  strawBatchCode: z.string().trim().optional(),
  semenCompany: z.string().trim().optional(),
  serviceCost: z.number().min(0).optional(),
  paymentMethod: paymentMethodEnum.optional(),
  expectedPregnancyCheckDate: z.string().optional(),
  notes: z.string().trim().optional(),
});
export const breedingEventSchema = withBreedingCostValidation(breedingEventBaseSchema);
export type CreateBreedingEventInput = z.infer<typeof breedingEventBaseSchema>;

/** Mirrors `EditBreedingEventDto` (RAKHAL-305) — every field optional, no `status` (derived-only). */
const editBreedingEventBaseSchema = z.object({
  cattleId: z.string().min(1, "Select a cow").optional(),
  breedingDate: z.string().min(1).optional(),
  breedingMethod: z.enum(["AI", "NATURAL", "EMBRYO_TRANSFER"]).optional(),
  bullId: z.string().optional(),
  semenBatchId: z.string().optional(),
  inseminator: z.string().trim().optional(),
  semenSource: semenSourceEnum.optional(),
  serviceProviderId: z.string().optional(),
  sireNameOrCode: z.string().trim().optional(),
  sireBreed: z.string().trim().optional(),
  semenType: semenTypeEnum.optional(),
  targetSex: targetSexEnum.optional(),
  strawBatchCode: z.string().trim().optional(),
  semenCompany: z.string().trim().optional(),
  serviceCost: z.number().min(0).optional(),
  paymentMethod: paymentMethodEnum.optional(),
  breedingNumber: z.number().min(1).optional(),
  expectedPregnancyCheckDate: z.string().optional(),
  notes: z.string().trim().optional(),
});
export const editBreedingEventSchema = withBreedingCostValidation(editBreedingEventBaseSchema);
export type EditBreedingEventInput = z.infer<typeof editBreedingEventBaseSchema>;

/** Mirrors `ReturnToHeatDto` (RAKHAL-316) — `:id` (the `BreedingEvent`) is a route param. */
export const returnToHeatSchema = z.object({
  heatDateTime: z.string().min(1),
  notes: z.string().trim().optional(),
});
export type ReturnToHeatInput = z.infer<typeof returnToHeatSchema>;

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

/** RAKHAL-317-F — mirrors `EditPregnancyDiagnosisDto` (RAKHAL-305), every field optional. */
export const editPregnancyDiagnosisSchema = z.object({
  breedingEventId: z.string().optional(),
  diagnosisDate: z.string().optional(),
  result: z.enum(["PREGNANT", "NOT_PREGNANT", "SUSPECTED"]).optional(),
  diagnosisMethod: z.enum(["ULTRASOUND", "PALPATION", "LAB"]).optional(),
  gestationDay: z.number().min(0).optional(),
  expectedCalvingDate: z.string().optional(),
  notes: z.string().trim().optional(),
});
export type EditPregnancyDiagnosisInput = z.infer<typeof editPregnancyDiagnosisSchema>;

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

/** Mirrors `CreateDryOffDto` (RD-038 + RAKHAL-274's `reason`) — `cattleId` is a route param
 * (`POST /reproduction/cattle/:id/dry-off`), not part of the body, so it's not in this schema. */
export const dryOffSchema = z.object({
  dryOffDate: z.string().optional(),
  reason: z.enum(["SCHEDULED", "LOW_PRODUCTION", "HEALTH", "PREGNANCY", "MANAGEMENT_DECISION"]).optional(),
  notes: z.string().trim().optional(),
});
export type CreateDryOffInput = z.infer<typeof dryOffSchema>;

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
