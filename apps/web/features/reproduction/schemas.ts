import { z } from "zod";
import { financePaymentMethodEnum } from "@/features/finance/schemas";

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

/** Mirrors `EditHeatEventDto` (RAKHAL-305) — every field optional on the wire; the "Correct heat record"
 * dialog edits these three and sends only the ones that changed. */
export const editHeatEventSchema = heatEventSchema.pick({ cattleId: true, heatDateTime: true, detectionMethod: true });
export type EditHeatEventFormValues = z.infer<typeof editHeatEventSchema>;
export type EditHeatEventInput = Partial<CreateHeatEventInput>;

/** Mirrors `VoidBreedingEventDto` - the reason is mandatory (it is the audit trail for the reversals). */
export const voidBreedingEventSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason").max(500),
});
export type VoidBreedingEventInput = z.infer<typeof voidBreedingEventSchema>;

/** Mirrors `ResolveHeatEventDto` (RAKHAL-298); `INSEMINATED` is stamped by the backend, never sent. */
export type ResolveHeatEventInput = { reason: "FALSE_ALARM" | "SKIPPED_CYCLE"; notes?: string };

/** Explicit semen provenance (no ticket #, 2026-08-15) — see `SemenSource` in `types.ts`. */
const semenSourceEnum = z.enum(["FARM_INVENTORY", "TECHNICIAN_SUPPLIED", "EXTERNAL"]);
const semenTypeEnum = z.enum(["CONVENTIONAL", "SEX_SORTED"]);
const targetSexEnum = z.enum(["FEMALE", "MALE"]);
/** RAKHAL-330: how a breeding/AI cost was paid — mirrors backend `FinancePaymentMethod`.
 * RAKHAL-355: was a local `z.enum(["CASH", "BANK_TRANSFER", "MFS", "WALLET"])` re-declaration,
 * now imports the one shared V1 (WALLET-inclusive) enum from `features/finance/schemas.ts` instead
 * — this still posts through the V1 `FinanceService.recordTransaction` route, which still accepts
 * WALLET, so it stays on the WALLET-inclusive type rather than the new V2 `PaymentMethod`
 * (`lib/types/payment.ts`), which the backend for this call site doesn't support. */
const paymentMethodEnum = financePaymentMethodEnum;

/** Shared cost-validation rule for breeding-event schemas — AI sourced from anything
 * other than farm inventory needs its own `serviceCost` (a farm-inventory straw was already
 * purchased and stocked, so AI usage records inventory consumption for the animal without
 * needing a finance account). `financialAccountId` is only required when an external
 * service cost is actually being paid. */
function withBreedingCostValidation<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.superRefine((data, ctx) => {
    const values = data as {
      breedingMethod?: string;
      semenSource?: string;
      serviceCost?: number;
      financialAccountId?: string;
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
    const serviceCostIsBeingSubmitted =
      values.serviceCost !== undefined && values.serviceCost > 0;
    if (serviceCostIsBeingSubmitted && !values.financialAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["financialAccountId"],
        message: "Account is required when recording a service cost",
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
  financialAccountId: z.string().optional(),
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
  financialAccountId: z.string().optional(),
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

/** Optional per-step schedule override when applying a protocol. */
export const stepScheduleOverrideSchema = z.object({
  dayNumber: z.number().int().min(0),
  stepId: z.string().optional(),
  dueAt: z.string().min(1),
});
export type StepScheduleOverrideInput = z.infer<typeof stepScheduleOverrideSchema>;

/** Mirrors `ApplyProtocolDto` — `startDate` ISO date-time or YYYY-MM-DD, defaults to now/today on the backend. */
export const applyProtocolSchema = z.object({
  protocolId: z.string().min(1, "Select a protocol"),
  cattleIds: z.array(z.string()).min(1, "Select at least one cow"),
  startDate: z.string().optional(),
  stepOverrides: z.array(stepScheduleOverrideSchema).optional(),
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

/** Mirrors `ReproStepType` (`repro-protocol.prisma`). */
export const reproStepTypeEnum = z.enum([
  "GNRH",
  "PGF2ALPHA",
  "CIDR_INSERT",
  "CIDR_REMOVE",
  "AI",
  "PREGNANCY_CHECK",
  "OTHER",
]);

/** RAKHAL-407 — one row of `CreateProtocolDto`/`UpdateProtocolDto`'s `steps[]`, mirrors `ProtocolStepDto`. */
export const protocolStepRowSchema = z.object({
  dayNumber: z.number().int().min(0),
  title: z.string().trim().min(1, "Title is required"),
  stepType: reproStepTypeEnum,
  instruction: z.string().trim().optional(),
  isRequired: z.boolean().optional(),
});
export type ProtocolStepRowInput = z.infer<typeof protocolStepRowSchema>;

/** RAKHAL-407 — create/edit a farm-owned protocol. Reused for both `POST` and `PATCH` (same shape,
 * same precedent `createHealthPlanFormSchema`/`CreateHealthPlanDialog` already established for the
 * sibling Health Plan engine — one form, `protocol` prop set switches it to edit mode). */
export const protocolFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  steps: z.array(protocolStepRowSchema).min(1, "Add at least one step"),
});
export type ProtocolFormInput = z.infer<typeof protocolFormSchema>;
