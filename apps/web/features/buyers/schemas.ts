import { z } from "zod";

export const BUYER_TYPES = ["DAIRY_COMPANY", "COOPERATIVE", "LOCAL_TRADER", "DIRECT_CONSUMER"] as const;

/** Create/Edit Buyer. No Figma frame — mirrors `CreateBuyerDto` exactly. */
export const buyerFormSchema = z.object({
  name: z.string().trim().min(1),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  buyerType: z.enum(BUYER_TYPES),
  paymentTermsDays: z.number().int().min(0).optional(),
  basePricePerLitre: z.number().min(0),
  baseFatPct: z.number().min(0).optional(),
  fatBonusPer01Pct: z.number().min(0).optional(),
  sccThreshold: z.number().int().min(0).optional(),
  sccPenaltyPer100k: z.number().min(0).optional(),
  collectionDays: z.array(z.string()).optional(),
  collectionTime: z.string().trim().optional(),
  bankDetails: z.string().trim().optional(),
});
export type BuyerFormInput = z.infer<typeof buyerFormSchema>;

/** Record Dispatch. Mirrors `RecordDispatchDto` — `dispatchedAt` defaults to now client-side. */
export const recordDispatchSchema = z.object({
  buyerId: z.string().trim().min(1),
  dispatchedAt: z.string().min(1),
  volumeDispatchedL: z.number().min(0.01),
  volumeReceivedL: z.number().min(0).optional(),
  fatPct: z.number().min(0).optional(),
  scc: z.number().int().min(0).optional(),
  notes: z.string().trim().optional(),
});
export type RecordDispatchInput = z.infer<typeof recordDispatchSchema>;

/** Buyer statement month picker — `?month=YYYY-MM`. */
export const statementMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
export type StatementMonthInput = z.infer<typeof statementMonthSchema>;
