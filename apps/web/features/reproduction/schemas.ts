import { z } from "zod";

// Heat / AI / pregnancy-check / calving / abortion / dry-off are recorded through `POST /cattle/:id/events` (`features/events`).
// What stays here are the protocol forms.

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
