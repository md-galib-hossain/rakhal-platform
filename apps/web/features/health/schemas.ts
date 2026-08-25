import { z } from "zod";

/** "Report Sickness" — mirrors `CreateHealthCaseDto`. Not Figma-sourced (no frame was given for this
 * modal); a plain FormDialog is needed so the sick-bay table has a real way to create cases. */
export const reportSicknessSchema = z.object({
  cattleId: z.string().min(1),
  diagnosis: z.string().trim().min(1),
  condition: z
    .enum(["MASTITIS", "LAMENESS", "METRITIS", "KETOSIS", "MILK_FEVER", "FEVER", "INJURY", "OTHER"])
    .optional(),
  diagnosisType: z.enum([
    "DISEASE",
    "INJURY",
    "VACCINATION",
    "DEWORMING",
    "ROUTINE_CHECKUP",
    "PREVENTIVE",
    "BREEDING_RELATED",
    "OTHER",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  symptoms: z.array(z.string()).optional(),
  notes: z.string().trim().optional(),
  temperature: z.number().min(35).max(45).optional(),
  appetite: z.enum(["NORMAL", "REDUCED", "NONE", "HIGH"]).optional(),
  staffObservation: z.string().trim().optional(),
});
export type ReportSicknessInput = z.infer<typeof reportSicknessSchema>;

/** Case Management sheet → "Log Treatment" tab (Figma 734:37459). Mirrors `LogTreatmentDto`. */
export const logTreatmentSchema = z.object({
  medicineId: z.string().optional(),
  medicineName: z.string().trim().optional(),
  route: z.enum(["IM", "IV", "SC", "ORAL", "TOPICAL", "OTHER"]).optional(),
  doseAmount: z.number().min(0).optional(),
  doseUnit: z.string().trim().optional(),
  administeredBy: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type LogTreatmentInput = z.infer<typeof logTreatmentSchema>;

/** Case Management sheet → "Health Update" tab (Figma 734:38378). Mirrors `CreateHealthUpdateDto`;
 * `temperature` is required in the Figma mock (marked with `*`) though the backend DTO allows it
 * optional — enforced here at the form level, matching the visual contract. */
export const healthUpdateSchema = z.object({
  clinicalProgress: z.enum(["IMPROVING", "WORSENING", "STABLE"]),
  symptoms: z.array(z.string()).optional(),
  temperature: z.number().min(35).max(45),
  appetite: z.enum(["NORMAL", "REDUCED", "NONE", "HIGH"]).optional(),
  appearance: z.enum(["BRIGHT", "DULL", "DEPRESSED", "WEAK"]).optional(),
  observation: z.string().trim().optional(),
});
export type HealthUpdateInput = z.infer<typeof healthUpdateSchema>;

/** Case Management sheet → "Close Case" tab, "Mark as Recovered" outcome (Figma 734:39319). */
export const closeRecoveredSchema = z.object({
  observation: z.string().trim().optional(),
});
export type CloseRecoveredInput = z.infer<typeof closeRecoveredSchema>;

/** Case Management sheet → "Close Case" → "Log Mortality" sub-tab (Figma 734:40144). Mirrors
 * `MortalityDto`; `additionalNotes` is required in the Figma mock (marked with `*`). */
export const logMortalitySchema = z.object({
  primaryCauseOfDeath: z.string().trim().min(1),
  vetSignOff: z.string().trim().optional(),
  symptoms: z.array(z.string()).optional(),
  postMortemPerformed: z.boolean().optional(),
  disposalMethod: z.string().trim().optional(),
  disposalCost: z.number().min(0).optional(),
  disposalLocation: z.string().trim().optional(),
  additionalNotes: z.string().trim().min(1),
});
export type LogMortalityInput = z.infer<typeof logMortalitySchema>;

/** "Create New Health Plan" wizard Step 1 (Figma 734:47059) — picks `planType` (`HealthPlanType`).
 * The mock's 3 cards read "Treatment"/"Breeding"/"Prevention" but the real enum value for the first
 * is `MEDICAL`, not `TREATMENT` — mapped in `create-health-plan-dialog.tsx`, not renamed here. */
export const healthPlanTypeSchema = z.object({
  planType: z.enum(["MEDICAL", "PREVENTION", "BREEDING", "GENERAL"]),
});
export type HealthPlanTypeInput = z.infer<typeof healthPlanTypeSchema>;

/** Step 2 (Figma 734:47993) — mirrors `CreateHealthPlanDto`'s top-level fields (minus `steps`,
 * `planType`, and `isTemplate`, collected in the other steps). */
export const healthPlanDetailsSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(["TREATMENT", "PREVENTION", "BREEDING", "VACCINATION", "DEWORMING", "ROUTINE"]),
  cycleLengthDays: z.number().int().min(1),
  description: z.string().trim().optional(),
});
export type HealthPlanDetailsInput = z.infer<typeof healthPlanDetailsSchema>;

/** Step 3 "Action Sequence Builder" (Figma 734:48743) — one row per `HealthPlanStepDto`. No
 * "Action" text input (removed per user request) — `title`/`instruction` on the wire are derived
 * from day number + medicine name in `create-health-plan-dialog.tsx`. */
export const healthPlanStepRowSchema = z.object({
  dayNumber: z.number().int().min(1),
  medicineName: z.string().trim().optional(),
  doseAmount: z.number().min(0).optional(),
});
export type HealthPlanStepRowInput = z.infer<typeof healthPlanStepRowSchema>;

export const healthPlanStepsSchema = z.object({
  steps: z.array(healthPlanStepRowSchema).min(1),
});
export type HealthPlanStepsInput = z.infer<typeof healthPlanStepsSchema>;

/** "Apply Health Plan Template" wizard Step 1 (Figma 734:49979). `selectionMethod` picks how the
 * "Selected Animals" list below is populated (shed/feed-group("Batch")/free search), not submitted
 * itself. */
export const applyHealthPlanStep1Schema = z.object({
  selectionMethod: z.enum(["shed", "batch", "individual"]),
  shedId: z.string().trim().optional(),
  feedGroupId: z.string().trim().optional(),
  excludePregnant: z.boolean().optional(),
  route: z.enum(["IM", "IV", "SC", "ORAL"]),
  startDate: z.string().min(1),
});
export type ApplyHealthPlanStep1Input = z.infer<typeof applyHealthPlanStep1Schema>;

/** The full "Create New Health Plan" wizard as one form (`create-health-plan-dialog.tsx` validates
 * a step's own fields via RHF's `trigger()` before advancing, rather than three separate forms). */
export const createHealthPlanFormSchema = healthPlanTypeSchema.merge(healthPlanDetailsSchema).merge(healthPlanStepsSchema);
export type CreateHealthPlanFormInput = z.infer<typeof createHealthPlanFormSchema>;
