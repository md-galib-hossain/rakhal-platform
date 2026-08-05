import { z } from "zod";

/** Mirrors the backend's `ReportParametersDto` — all optional, per-report generators read what they need. */
export const reportParametersSchema = z.object({
  date: z.string().optional(),
  month: z.string().optional(),
  year: z.string().optional(),
  shedId: z.string().optional(),
  cattleId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
});

export const generateReportSchema = z.object({
  reportId: z.string().min(1),
  format: z.enum(["pdf", "csv"]),
  parameters: reportParametersSchema.optional(),
});
export type GenerateReportInput = z.infer<typeof generateReportSchema>;

export const createScheduleSchema = z
  .object({
    reportId: z.string().min(1),
    format: z.enum(["pdf", "csv"]),
    frequency: z.enum(["daily", "weekly", "monthly"]),
    dayOfWeek: z.number().int().min(1).max(7).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
  })
  .refine((v) => v.frequency !== "weekly" || v.dayOfWeek !== undefined, {
    message: "dayOfWeek is required for a weekly schedule",
    path: ["dayOfWeek"],
  })
  .refine((v) => v.frequency !== "monthly" || v.dayOfMonth !== undefined, {
    message: "dayOfMonth is required for a monthly schedule",
    path: ["dayOfMonth"],
  });
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
