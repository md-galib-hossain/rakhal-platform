import { z } from "zod";
import { paymentMethodSchema } from "@/lib/types/payment";
import { PRODUCT_SALE_SUBTYPES, RECORD_SALE_TYPES } from "./types";

/**
 * RAKHAL-357 — one zod schema for the whole Record Sale wizard, all fields optional at the schema
 * level (react-hook-form's `Controller` needs *something* to register even for a step that's
 * currently blocked) — the wizard's own `onValidateStep` per-step field lists (mirroring
 * `Wizard`'s `onValidateStep(fields, index)` contract, RAKHAL-355) are what actually enforce which
 * fields are required for a given `type`/`productSubtype` combination, same shape
 * `record-transaction-dialog.tsx`'s `goNext` used for its per-step `form.trigger(fieldsToValidate)`
 * list.
 *
 * Plain `z.number()`, not `z.coerce.number()` — every numeric field here is either driven through
 * `MoneyInput`'s own `number | undefined` contract (`amountReceived`) or a plain `register()`'d
 * input paired with this file's `numberField` `setValueAs` adapter (`record-sale-wizard.tsx`,
 * same precedent as `record-transaction-dialog.tsx`'s own `numberField`) — the string→number
 * conversion already happens before react-hook-form's internal state is touched, so the resolver
 * only ever sees a real `number`. `z.coerce.number()` would additionally accept the *pre*-convert
 * string here and silently mask a wiring bug; it also doesn't type-check against `zodResolver`
 * without widening every field to `unknown` on the input side (confirmed via `tsc`).
 */
export const recordSaleFormSchema = z.object({
  type: z.enum(RECORD_SALE_TYPES),
  productSubtype: z.enum(PRODUCT_SALE_SUBTYPES).optional(),

  // Inventory item — `POST /sales/inventory` (RAKHAL-376): itemType/itemId real FK via ItemPicker,
  // quantity*unitPrice computes the Sale Total.
  itemKind: z.enum(["MEDICINE", "FEED_ITEM", "EQUIPMENT"]).optional(),
  itemId: z.string().optional(),
  itemName: z.string().optional(),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().min(0).optional(),
  // Manure — `POST /sales/manure` (RAKHAL-376): `totalAmount` is the only required money figure
  // server-side (no quantity*unitPrice derivation), reuses the `amount` field Other Income already
  // declares rather than adding a second identical numeric field.
  description: z.string().optional(),

  // Animal (UI-only — no live backend route yet)
  cattleId: z.string().optional(),
  salePrice: z.number().min(0).optional(),

  // Other Income (wired)
  categoryId: z.string().optional(),
  amount: z.number().positive().optional(),

  saleDate: z.string().min(1, "Required"),
  notes: z.string().optional(),

  // Payment step
  financialAccountId: z.string().optional(),
  amountReceived: z.number().min(0).optional(),
  paymentMethod: paymentMethodSchema.optional(),
});

export type RecordSaleFormInput = z.infer<typeof recordSaleFormSchema>;

export const SELL_MILK_SETTLEMENTS = ["PAID_NOW", "ON_CREDIT"] as const;
export type SellMilkSettlement = (typeof SELL_MILK_SETTLEMENTS)[number];

/**
 * One-screen "Sell Milk" form. Unlike `recordSaleFormSchema` (every field optional, enforced per
 * wizard step) this one is strict, because the whole sale is a single submit. Cross-field rules that
 * need the buyer's price (stock limit, amount ≤ total) live in the component, where the buyer is known.
 * `paymentMethod` always has a value (the sheet defaults it to Cash) and is only sent when paid now.
 */
export const sellMilkSchema = z
  .object({
    buyerId: z.string().min(1),
    volumeL: z.number().positive(),
    saleDate: z.string().min(1),
    fatPct: z.number().min(0).optional(),
    scc: z.number().int().min(0).optional(),
    notes: z.string().optional(),
    settlement: z.enum(SELL_MILK_SETTLEMENTS),
    amountReceived: z.number().min(0).optional(),
    paymentMethod: paymentMethodSchema,
  })
  .superRefine((value, ctx) => {
    if (value.settlement === "PAID_NOW" && !((value.amountReceived ?? 0) > 0)) {
      ctx.addIssue({ code: "custom", path: ["amountReceived"], message: "required" });
    }
  });

export type SellMilkFormInput = z.infer<typeof sellMilkSchema>;
