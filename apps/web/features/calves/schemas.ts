import { z } from "zod";

/**
 * Mirrors the backend's calf log/wean DTOs exactly (`record-colostrum.dto.ts`,
 * `record-milk-feeding.dto.ts`, `record-weight.dto.ts`, `record-starter-feed.dto.ts`,
 * `wean-calf.dto.ts` — verified live via source, not the aspirational API doc).
 */

export const recordColostrumSchema = z.object({
  feedNumber: z.number().min(1),
  fedAt: z.string().min(1),
  volumeMl: z.number().min(0),
  quality: z.enum(["EXCELLENT", "GOOD", "POOR", "UNKNOWN"]).optional(),
  fedBy: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type RecordColostrumInput = z.infer<typeof recordColostrumSchema>;

export const recordMilkFeedingSchema = z.object({
  date: z.string().min(1),
  morningMl: z.number().min(0).optional(),
  eveningMl: z.number().min(0).optional(),
  type: z.enum(["DAM_MILK", "WHOLE_MILK", "MILK_REPLACER"]).optional(),
  notes: z.string().trim().optional(),
});
export type RecordMilkFeedingInput = z.infer<typeof recordMilkFeedingSchema>;

export const recordWeightSchema = z.object({
  weightKg: z.number().min(0),
  measuredDate: z.string().min(1),
  notes: z.string().trim().optional(),
});
export type RecordWeightInput = z.infer<typeof recordWeightSchema>;

export const recordStarterFeedSchema = z.object({
  date: z.string().min(1),
  eventType: z.enum(["FIRST_OFFERED", "FIRST_INTAKE", "DAILY_INTAKE"]),
  amountG: z.number().min(0).optional(),
  notes: z.string().trim().optional(),
});
export type RecordStarterFeedInput = z.infer<typeof recordStarterFeedSchema>;

export const weanCalfSchema = z.object({
  weaningDate: z.string().min(1),
  weaningWeightKg: z.number().min(0).optional(),
  notes: z.string().trim().optional(),
});
export type WeanCalfInput = z.infer<typeof weanCalfSchema>;
