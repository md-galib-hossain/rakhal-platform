import { z } from "zod";
import { EXPENSE_CATEGORIES, PURCHASE_NEW_ITEM_KINDS } from "./types";

const MEDICINE_TYPE_VALUES = ["LIQUID", "POWDER", "TABLET", "INJECTABLE", "BOLUS", "OINTMENT", "OTHER"] as const;
const MEDICINE_CATEGORY_VALUES = [
  "ANTIBIOTIC",
  "ANTIPARASITIC",
  "VACCINE",
  "VITAMIN",
  "MINERAL",
  "HORMONE",
  "ANTI_INFLAMMATORY",
  "ANALGESIC",
  "OTHER",
] as const;
const FEED_CLASS_VALUES = ["FORAGE", "CONCENTRATE", "MINERAL", "VITAMIN", "ADDITIVE", "OTHER"] as const;

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

/** A brand-new item typed into the purchase line (sent as `newItem`). Which fields are needed depends
 * on the kind, mirroring `PurchaseNewItemDto`: MEDICINE needs a unit + type + category, FEED a unit + a
 * catalogue ingredient (the new item copies its nutrition) + the ingredient's feed class, EQUIPMENT only
 * a name (unit optional). */
export const newItemDraftSchema = z
  .object({
    kind: z.enum(PURCHASE_NEW_ITEM_KINDS),
    name: z.string().trim().min(1, "required"),
    unitId: z.string().optional(),
    medicineType: z.enum(MEDICINE_TYPE_VALUES).optional(),
    medicineCategory: z.enum(MEDICINE_CATEGORY_VALUES).optional(),
    ingredientId: z.string().optional(),
    feedClass: z.enum(FEED_CLASS_VALUES).optional(),
  })
  .superRefine((item, ctx) => {
    const need = (field: keyof typeof item) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "required" });
    if (item.kind !== "EQUIPMENT" && !item.unitId) need("unitId");
    if (item.kind === "MEDICINE") {
      if (!item.medicineType) need("medicineType");
      if (!item.medicineCategory) need("medicineCategory");
    }
    if (item.kind === "FEED" && (!item.ingredientId || !item.feedClass)) need("ingredientId");
  });

export type NewItemDraft = z.infer<typeof newItemDraftSchema>;

const purchaseLineSchema = z
  .object({
    itemKind: z.enum(["MEDICINE", "FEED_ITEM", "EQUIPMENT"]),
    /** Existing item — empty when `newItem` is set. */
    itemId: z.string(),
    itemName: z.string(),
    /** Real stock/unit of the picked item, shown on the line's stock chip. */
    itemStock: z.number().optional(),
    itemUnit: z.string().optional(),
    newItem: newItemDraftSchema.optional(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
    /** A medicine lot always has its own expiry (`CreatePurchaseLineDto.expiryDate`). */
    expiryDate: z.string().optional(),
    batchCode: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    if (!line.itemId && !line.newItem) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["itemId"], message: "required" });
    }
    if (line.itemKind === "MEDICINE" && !line.expiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiryDate"], message: "required" });
    }
  });

export type PurchaseLineFormInput = z.infer<typeof purchaseLineSchema>;

/** How the purchase is settled: pay it all now (default), part now + the rest owed, or nothing now. */
export const PURCHASE_PAYMENT_MODES = ["FULL", "PART", "CREDIT"] as const;
export type PurchasePaymentMode = (typeof PURCHASE_PAYMENT_MODES)[number];

export const purchaseFormSchema = z
  .object({
    /** RAKHAL-391: `BUSINESS_IA_PRD.md` §5.13's field table marks Supplier `required` in this
     * modal — a client-side UI requirement, stricter than `CreatePurchaseDto.supplierId` which
     * stays optional server-side for a walk-up cash purchase with no counterparty. */
    supplierId: z.string().min(1, "required"),
    purchaseDate: z.string().min(1),
    notes: z.string().optional(),
    lines: z.array(purchaseLineSchema).min(1),
    paymentMode: z.enum(PURCHASE_PAYMENT_MODES),
    /** Only read for `PART` (FULL pays the computed total, CREDIT pays nothing). */
    paidAmount: z.number().min(0).optional(),
    dueDate: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.paymentMode !== "PART") return;
    const total = computePurchaseTotal(values.lines);
    const paid = values.paidAmount ?? 0;
    if (paid <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidAmount"], message: "required" });
    else if (paid >= total) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidAmount"], message: "belowTotal" });
  });

export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>;

/** Amount paid at creation for a payment mode — FULL is the computed total, CREDIT is nothing. */
export function purchasePaidAmount(mode: PurchasePaymentMode, total: number, partAmount: number | undefined): number {
  if (mode === "FULL") return total;
  if (mode === "PART") return Math.min(Math.max(partAmount ?? 0, 0), total);
  return 0;
}

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
