import { z } from "zod";

/**
 * "Record" transaction wizard (Figma "What are you recording?" `1039:25889` Step 1 + "Expense
 * Details"/"Expense Summary" `1039:31829`/`1039:32190`/`1039:32555` Steps 2-3 — file
 * `SCfMPdxP6vgW1uTxfqCtz7`). Only the Operating Expense field set has a real Figma frame; Revenue/
 * Inventory Purchase/Debt-Loan reuse the same Step 2/3 chrome with their own real `CreateTransactionDto`
 * fields substituted in (flagged per-field in `record-transaction-dialog.tsx`'s doc comment — not a
 * Figma-sourced layout for those three, an extrapolation of the one real frame we do have).
 */
export const TRANSACTION_TYPES = ["OPERATING_EXPENSE", "INVENTORY_PURCHASE", "REVENUE", "DEBT_LOAN"] as const;

/** One flat schema for the whole 3-step wizard (Step 1 picks `type`, Step 2 fills the rest, Step 3
 * is a read-only review of Steps 1-2) — same "one form, `trigger()` a step's fields before advancing"
 * shape as `CreateHealthPlanDialog`'s `createHealthPlanFormSchema`, not three separate forms. */
export const recordTransactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    subType: z.string().trim().min(1),
    entityName: z.string().trim().optional(),
    amount: z.number().min(0.01),
    paymentType: z.enum(["FULL", "PARTIAL"]),
    paidNow: z.number().min(0).optional(),
    dueDate: z.string().optional(),
    paymentDate: z.string().min(1),
    notes: z.string().trim().optional(),
    // Revenue / animal sale (real side effect: marks the animal SOLD server-side).
    cattleId: z.string().optional(),
    // Inventory Purchase (real side effect: auto-increments matching Medicine/Forage stock).
    inventoryItemName: z.string().trim().optional(),
    quantity: z.number().min(0).optional(),
    costPerUnit: z.number().min(0).optional(),
    // Debt / Loan.
    monthlyEmi: z.number().min(0).optional(),
    startDate: z.string().optional(),
    durationMonths: z.number().int().min(0).optional(),
    loanId: z.string().optional(),
  })
  .refine((v) => v.paymentType !== "PARTIAL" || (v.paidNow != null && v.paidNow > 0), {
    message: "paidNow is required for a partial payment",
    path: ["paidNow"],
  });
export type RecordTransactionFormInput = z.infer<typeof recordTransactionFormSchema>;

/** "Add Funds to Wallet" (Figma `1039:32932`). Mirrors `AddFundsDto` — the mock's "Fund Name" input
 * has no matching DTO field (only `description`); mapped onto the real field, flagged in
 * `add-funds-dialog.tsx`'s doc comment. */
export const addFundsSchema = z.object({
  description: z.string().trim().min(1),
  amount: z.number().min(0.01),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MFS"]),
});
export type AddFundsInput = z.infer<typeof addFundsSchema>;

/** "Withdraw Funds" (Figma `1039:33295`). Mirrors `WithdrawDto` exactly — `fundName` is a real field here. */
export const withdrawSchema = z.object({
  fundName: z.string().trim().min(1),
  amount: z.number().min(0.01),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MFS"]),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;
