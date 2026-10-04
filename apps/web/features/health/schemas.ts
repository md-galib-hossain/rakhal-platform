import { z } from "zod";

/** "Report Sickness" — mirrors `CreateHealthCaseDto`. Not Figma-sourced (no frame was given for this
 * modal); a plain FormDialog is needed so the sick-bay table has a real way to create cases. */
export const reportSicknessSchema = z.object({
  cattleId: z.string().min(1),
  /** RAKHAL-418: `condition` is the primary classifier (required here); `note` is optional detail. */
  condition: z.enum(["MASTITIS", "LAMENESS", "METRITIS", "KETOSIS", "MILK_FEVER", "FEVER", "INJURY", "OTHER"]),
  note: z.string().trim().optional(),
  /** Report Sickness always opens a curative case — preventive rounds go through protocols (RAKHAL-415). */
  careType: z.enum(["CURATIVE", "PREVENTIVE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  symptoms: z.array(z.string()).optional(),
  notes: z.string().trim().optional(),
  temperature: z.number().min(35).max(45).optional(),
  appetite: z.enum(["NORMAL", "REDUCED", "NONE", "HIGH"]).optional(),
  staffObservation: z.string().trim().optional(),
  assignedVet: z.string().trim().optional(),
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

/** "Quick Treat" (RFE-108) — the animal-selection fields (shed/batch/individual) mirror
 * `apply-health-plan-dialog.tsx`'s own `applyHealthPlanStep1Schema`; `cattleIds`/`medicineId` are
 * kept as plain component state (a `Set<string>`/`MedicineOption`), not RHF fields, matching that
 * same dialog's split. */
export const quickTreatSchema = z.object({
  selectionMethod: z.enum(["shed", "batch", "individual"]),
  shedId: z.string().trim().optional(),
  animalGroupId: z.string().trim().optional(),
  treatedAt: z.string().min(1),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type QuickTreatInput = z.infer<typeof quickTreatSchema>;

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
  /** RAKHAL-468 — optional; lets Report Sickness suggest this protocol for a case with the same condition. Only asked
   * for treatment protocols. */
  condition: z.enum(["MASTITIS", "LAMENESS", "METRITIS", "KETOSIS", "MILK_FEVER", "FEVER", "INJURY", "OTHER"]).nullish(),
});
export type HealthPlanDetailsInput = z.infer<typeof healthPlanDetailsSchema>;

/** Step 3 "Action Sequence Builder" (Figma 734:48743) — one row per `HealthPlanStepDto`. No
 * "Action" text input (removed per user request) — `title`/`instruction` on the wire are derived
 * from day number + medicine name in `create-health-plan-dialog.tsx`. */
export const healthPlanStepRowSchema = z.object({
  dayNumber: z.number().int().min(1),
  /** Protocols v2 — the medicine is always picked from inventory (`medicineId`), never typed. */
  medicineId: z.string().min(1, "Pick a medicine from inventory"),
  medicineName: z.string().trim().min(1, "Pick a medicine from inventory"),
  /** Display only: the picked medicine's own unit + stock, so the dose-unit list and the out-of-stock hint don't refetch. */
  medicineUnitId: z.string().optional(),
  medicineUnitSymbol: z.string().optional(),
  medicineStock: z.number().optional(),
  doseAmount: z.number({ message: "Enter a dose" }).gt(0, "Dose must be greater than 0"),
  doseUnitId: z.string().min(1, "Pick a unit"),
  /** Optional "HH:mm" — empty/undefined means any time that day. */
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")
    .optional()
    .or(z.literal("")),
});
export type HealthPlanStepRowInput = z.infer<typeof healthPlanStepRowSchema>;

export const healthPlanStepsSchema = z.object({
  steps: z.array(healthPlanStepRowSchema).min(1),
});
export type HealthPlanStepsInput = z.infer<typeof healthPlanStepsSchema>;

/** "Apply Health Plan Template" wizard Step 1 (Figma 734:49979). `selectionMethod` picks how the
 * "Selected Animals" list below is populated (shed/animal-group("Batch")/free search), not submitted
 * itself. */
export const applyHealthPlanStep1Schema = z.object({
  selectionMethod: z.enum(["shed", "batch", "individual"]),
  shedId: z.string().trim().optional(),
  animalGroupId: z.string().trim().optional(),
  excludePregnant: z.boolean().optional(),
  route: z.enum(["IM", "IV", "SC", "ORAL"]),
  startDate: z.string().min(1),
});
export type ApplyHealthPlanStep1Input = z.infer<typeof applyHealthPlanStep1Schema>;

/** The full "Create New Health Plan" wizard as one form (`create-health-plan-dialog.tsx` validates
 * a step's own fields via RHF's `trigger()` before advancing, rather than three separate forms). */
export const createHealthPlanFormSchema = healthPlanTypeSchema.merge(healthPlanDetailsSchema).merge(healthPlanStepsSchema);
export type CreateHealthPlanFormInput = z.infer<typeof createHealthPlanFormSchema>;

/** "Report Sickness" → "Several animals" mode (RFE-139, backend RAKHAL-469). The animals are plain component state (a
 * `Map` of the picked animals), not an RHF field — same split `quick-treat-dialog.tsx` makes; the rest mirrors
 * `BulkCreateHealthCasesDto`. `condition` is required here (the single form requires it too). */
export const reportSicknessBulkSchema = z.object({
  condition: reportSicknessSchema.shape.condition,
  priority: reportSicknessSchema.shape.priority,
  note: z.string().trim().optional(),
  symptoms: z.array(z.string()).optional(),
  assignedVet: z.string().trim().optional(),
});
export type ReportSicknessBulkInput = z.infer<typeof reportSicknessBulkSchema>;
