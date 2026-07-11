import { z } from "zod";
import { MILK_SESSIONS } from "./types";

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
