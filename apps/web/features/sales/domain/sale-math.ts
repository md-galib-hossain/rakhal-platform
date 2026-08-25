/**
 * RAKHAL-357 — pure Sale Total / Due derivation, deliberately isolated from any component so it's
 * unit-testable without mounting the wizard (`sale-math.test.ts`). This is the core correctness
 * this ticket delivers per `FINANCE_V2_DESIGN.md` §4.6: **payment status is derived, never
 * chosen** — V1 asked the farmer to pick Full/Partial (`record-transaction-dialog.tsx`'s
 * `paymentType` field); V2 asks for "Amount Received" and computes everything else.
 *
 * All money math here mirrors the rounding the backend itself uses (`round2` /
 * `src/common/money.ts#toStorage` — 2-decimal, half-away-from-zero) so the number the wizard shows
 * before submit matches what the ledger actually records after it, to the cent.
 */

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Line total for a quantity × unit-price product/animal sale line. Not used by Other Income,
 * which has no quantity/unit-price — the farmer types the amount directly. */
export function computeLineTotal(quantity: number | undefined, unitPrice: number | undefined): number {
  return round2((quantity ?? 0) * (unitPrice ?? 0));
}

/** Sums a sale's lines into its Sale Total — deliberately named "Sale Total", not "Total Cost"
 * (V1's Inventory Purchase / Milk sub-type both labeled the identical `quantity × price`
 * computation "Total Cost", the wrong frame for a *revenue* screen — this ticket's own AC). */
export function computeSaleTotal(lines: { quantity: number | undefined; unitPrice: number | undefined }[]): number {
  return round2(lines.reduce((sum, line) => sum + computeLineTotal(line.quantity, line.unitPrice), 0));
}

/** Derived Due = Sale Total − Amount Received, clamped to `[0, total]` — an over-payment never
 * shows as a negative Due (the payment/allocation step itself is capped at the outstanding
 * amount, mirroring `Receivable.assertWithinOutstanding` server-side, so this clamp is
 * belt-and-braces for display only, never silently absorbing a real over-payment). */
export function computeDue(saleTotal: number, amountReceived: number | undefined): number {
  const received = amountReceived ?? 0;
  return round2(Math.min(Math.max(saleTotal - received, 0), saleTotal));
}

/** The four-state status `FINANCE_V2_DESIGN.md` §4.6 defines — mirrors
 * `ReceivableService.deriveStatus` exactly (this is a display-only re-derivation for the wizard's
 * review step; the real, authoritative status always comes from the backend after submit). */
export type DerivedPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export function derivePaymentStatus(saleTotal: number, amountReceived: number | undefined): DerivedPaymentStatus {
  const received = amountReceived ?? 0;
  if (received <= 0) return "UNPAID";
  if (received >= saleTotal) return "PAID";
  return "PARTIALLY_PAID";
}

/** Clamps a typed "Amount Received" so it can never exceed the sale total (over-payment on a
 * brand-new sale isn't a real concept — there's no existing outstanding balance to overpay
 * against yet) nor go negative. Applied on blur, same UX precedent as `MoneyInput`'s own `min`
 * clamp. */
export function clampAmountReceived(amount: number | undefined, saleTotal: number): number | undefined {
  if (amount == null) return amount;
  return round2(Math.min(Math.max(amount, 0), saleTotal));
}
