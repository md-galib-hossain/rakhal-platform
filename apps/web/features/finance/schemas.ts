import { z } from "zod";

/**
 * "Record" transaction wizard (Figma "What are you recording?" `1039:25889` Step 1 + Operating
 * Expense's "Expense Details"/"Expense Summary" `1039:31829`/`1039:32190`/`1039:32555` + Inventory
 * Purchase's own "Purchase Details"/"Purchase Summary" `1039:30721`/`1039:31083`/`1039:31449` +
 * Revenue/Sale's own "Sale Details"/"Sale Summary" `1039:28862` (Milk)/`1039:29238` (Animal)/
 * `1039:29613` (Manure)/`1039:29986` (Others)/`1039:30360` (summary) + Debt/Loan's own "Debt
 * Management"/Summary frames (`1039:27017` Step 1 reused / `1039:27393` New Loan / `1039:28124` EMI
 * Payment / `1039:27757` New Loan summary / `1039:28505` EMI Payment summary) — file
 * `SCfMPdxP6vgW1uTxfqCtz7`). All 4 types now have real Figma frames. Real gap,
 * flagged not fabricated: Inventory Purchase's real "Purchase Details" frame has **no category/
 * subType select at all** (unlike Operating Expense's "Expense Category" dropdown) — `subType` is
 * optional here specifically so that type stays unset for Inventory Purchase rather than inventing a
 * category the mock never asks for. Revenue/Sale's "Sales Type" is real (Milk/Animal/Manure/Others,
 * rendered as segmented tab-pills, not a dropdown like Operating Expense's) but each sub-type has a
 * genuinely different field set below it — see `record-transaction-dialog.tsx`'s doc comment.
 */
export const TRANSACTION_TYPES = ["OPERATING_EXPENSE", "INVENTORY_PURCHASE", "REVENUE", "DEBT_LOAN"] as const;

/** One flat schema for the whole 3-step wizard (Step 1 picks `type`, Step 2 fills the rest, Step 3
 * is a read-only review of Steps 1-2) — same "one form, `trigger()` a step's fields before advancing"
 * shape as `CreateHealthPlanDialog`'s `createHealthPlanFormSchema`, not three separate forms. */
export const recordTransactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    subType: z.string().trim().optional(),
    entityName: z.string().trim().optional(),
    amount: z.number().min(0.01),
    paymentType: z.enum(["FULL", "PARTIAL"]),
    paidNow: z.number().min(0).optional(),
    dueDate: z.string().optional(),
    // New Loan has no separate "Payment Date" field (Figma `1039:27393` — Start Date covers it, see
    // the `startDate` refine below), so this can't be an unconditional `.min(1)` — a hidden, never-
    // populated field would otherwise silently fail validation on every New Loan submit.
    paymentDate: z.string().optional(),
    notes: z.string().trim().optional(),
    // Revenue / animal sale (real side effect: marks the animal SOLD server-side).
    cattleId: z.string().optional(),
    // Revenue / milk sale — real `CreateTransactionDto` fields, computed into `amount` (see the
    // dialog's `useEffect`), same "no separate typed Amount field for this sub-type" shape as
    // Inventory Purchase's Total Cost.
    litresSold: z.number().min(0).optional(),
    pricePerLitre: z.number().min(0).optional(),
    // Inventory Purchase (real side effect: auto-increments matching Medicine/FeedItem stock).
    inventoryItemName: z.string().trim().optional(),
    quantity: z.number().min(0).optional(),
    costPerUnit: z.number().min(0).optional(),
    // Debt / Loan. `interestRate` has no matching `CreateTransactionDto` field at all (`FinanceLoan`
    // stores no rate either) — kept client-side only, purely to drive the live Monthly EMI
    // calculation (`record-transaction-dialog.tsx`'s `computeMonthlyEmi`), never sent on submit.
    interestRate: z.number().min(0).max(100).optional(),
    monthlyEmi: z.number().min(0).optional(),
    startDate: z.string().optional(),
    durationMonths: z.number().int().min(0).optional(),
    loanId: z.string().optional(),
  })
  .refine((v) => v.type === "INVENTORY_PURCHASE" || Boolean(v.subType), {
    message: "subType is required",
    path: ["subType"],
  })
  .refine((v) => v.paymentType !== "PARTIAL" || (v.paidNow != null && v.paidNow > 0), {
    message: "paidNow is required for a partial payment",
    path: ["paidNow"],
  })
  .refine((v) => v.type !== "DEBT_LOAN" || v.subType !== "new_loan" || Boolean(v.startDate), {
    message: "startDate is required for a new loan",
    path: ["startDate"],
  })
  .refine((v) => v.type !== "DEBT_LOAN" || v.subType !== "new_loan" || (v.durationMonths != null && v.durationMonths > 0), {
    message: "durationMonths is required for a new loan",
    path: ["durationMonths"],
  })
  .refine((v) => v.type !== "DEBT_LOAN" || v.subType !== "emi_payment" || Boolean(v.loanId), {
    message: "loanId is required for an EMI payment",
    path: ["loanId"],
  })
  .refine((v) => v.type === "DEBT_LOAN" && v.subType === "new_loan" ? true : Boolean(v.paymentDate), {
    message: "paymentDate is required",
    path: ["paymentDate"],
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
