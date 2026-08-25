import { z } from "zod";
import { EXPENSE_CATEGORIES } from "./types";

/**
 * RAKHAL-359 — react-hook-form + zod schemas for Record Expense / Record Purchase. Mirrors
 * `RecordExpenseDto`/`CreatePurchaseDto`/`CreatePurchaseLineDto` field-for-field (checked directly
 * against the backend source, not guessed).
 */

export const expenseFormSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().min(1),
    amount: z.number().positive(),
    expenseDate: z.string().min(1),
    /** "paid now" toggle drives which of these two are required — enforced below, not by the raw
     * field types (mirrors the backend's own conditional: an account implies paid-in-full, no
     * account means the full amount raises a `Payable`). */
    paidNow: z.boolean(),
    financialAccountId: z.string().optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.paidNow && !values.financialAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["financialAccountId"], message: "required" });
    }
  });

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;

const purchaseLineSchema = z
  .object({
    itemKind: z.enum(["MEDICINE", "FEED_ITEM", "EQUIPMENT"]),
    itemId: z.string().min(1),
    itemName: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
  });

export type PurchaseLineFormInput = z.infer<typeof purchaseLineSchema>;

export const purchaseFormSchema = z
  .object({
    supplierId: z.string().optional(),
    purchaseDate: z.string().min(1),
    notes: z.string().optional(),
    lines: z.array(purchaseLineSchema).min(1),
    /** "paid now" toggle drives whether `paidAmount`/`financialAccountId` are required — a purchase
     * can also be *partially* paid (unlike an expense), so `paidAmount` is a free amount up to the
     * computed total, not an implicit "full amount" flag. */
    paidNow: z.boolean(),
    paidAmount: z.number().min(0).optional(),
    financialAccountId: z.string().optional(),
    dueDate: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.paidNow) {
      if (!values.financialAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["financialAccountId"], message: "required" });
      }
      if (values.paidAmount == null || values.paidAmount <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidAmount"], message: "required" });
      }
    }
  });

export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>;

/** `SUM(quantity * unitCost)` across lines — mirrors `PurchaseService.createWithClient`'s own
 * computation exactly (`lineComputations`/`totalAmount`), so the form's live total always matches
 * what the server will actually compute and never trusts a client-side "total" field. Exported
 * standalone for unit testing (RAKHAL-359's own AC: "Vitest for the purchase-total derivation"). */
export function computePurchaseTotal(lines: { quantity: number; unitCost: number }[]): number {
  return round2(lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0));
}

/** Outstanding remainder after `paidAmount` — mirrors `PurchaseService`'s `outstanding = totalAmount
 * - paidAmount`. Never negative (a `paidAmount` exceeding the total is a validation error the form
 * blocks before this is ever called with such input). */
export function computePurchaseOutstanding(total: number, paidAmount: number): number {
  return round2(Math.max(0, total - paidAmount));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
