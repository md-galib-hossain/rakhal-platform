import { z } from "zod";
import { MILK_QUALITY_TEST_SOURCES, MILK_SESSIONS } from "./types";

/** Mirrors the backend's `SaveMilkLogDto`/`MilkLogEntryDto`. */
export const saveMilkLogSchema = z.object({
  date: z.string(),
  session: z.enum(MILK_SESSIONS),
  entries: z
    .array(
      z.object({
        cattleId: z.string().min(1),
        yieldL: z.number().min(0),
        anomalyNote: z.string().optional(),
      }),
    )
    .min(1),
});
export type SaveMilkLogFormInput = z.infer<typeof saveMilkLogSchema>;

/** Mirrors the backend's `ReviewAnomalyDto`. */
export const reviewAnomalySchema = z.object({
  action: z.string().trim().min(1),
  notes: z.string().trim().optional(),
});
export type ReviewAnomalyFormInput = z.infer<typeof reviewAnomalySchema>;

/** Mirrors the backend's `CreateMilkQualityTestDto` validators exactly (0–100 pct bounds,
 * non-negative SCC/MUN, required `cattleId`/`lactationId`/`sampleDate`/`source`). Plain `z.number()`
 * (not `.coerce`/`.preprocess`) to match the rest of the codebase's numeric-field convention
 * (`recordWeightSchema`, `calving-event-dialog`'s `birthWeight`, etc.) — `register(field, {
 * valueAsNumber: true })` does the string→number conversion on the input side instead, keeping the
 * zod schema's input/output types identical (avoids a `zodResolver` generic mismatch). */
export const createMilkQualityTestSchema = z.object({
  cattleId: z.string().min(1),
  lactationId: z.string().min(1, "Select a lactation."),
  sampleDate: z.string().min(1),
  fatPct: z.number().min(0).max(100),
  proteinPct: z.number().min(0).max(100),
  lactosePct: z.number().min(0).max(100).optional(),
  somaticCellCount: z.number().min(0).optional(),
  milkUreaNitrogen: z.number().min(0).optional(),
  source: z.enum(MILK_QUALITY_TEST_SOURCES),
  notes: z.string().trim().optional(),
});
export type CreateMilkQualityTestFormInput = z.infer<typeof createMilkQualityTestSchema>;
