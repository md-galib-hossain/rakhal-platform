/**
 * RAKHAL-364 (MILESTONE 22, `BUSINESS_IA_PRD.md` §6.4) — "Sale IS the
 * invoice" due-date rule. **Do not add `dueDate` to `Sale`** —
 * `Receivable.dueDate` already exists and is indexed, and is what
 * `ReceivableService.getStatus` derives `OVERDUE` from. A second column
 * would be two sources of truth for one date.
 *
 * When a sale-type use case doesn't pass an explicit due date, derive
 * `saleDate + MilkBuyer.paymentTermsDays`. No due date when there is no
 * customer, or when the customer's `paymentTermsDays` is `0` (COD/no
 * terms) — a `dueDate` of "the same day" is not meaningfully different
 * from "no due date at all", and a `Sale` with no `Receivable` is already
 * PAID-by-definition with no due date; this keeps that same "no date means
 * nothing is owed on a schedule" reading consistent for an unpaid COD sale.
 */
export function deriveSaleDueDate(
  saleDate: Date,
  paymentTermsDays: number | null | undefined,
): Date | null {
  if (!paymentTermsDays || paymentTermsDays <= 0) {
    return null;
  }
  const due = new Date(saleDate);
  due.setUTCDate(due.getUTCDate() + paymentTermsDays);
  return due;
}
