/**
 * RAKHAL-365 (MILESTONE 22) — when a `Purchase`/`Expense` doesn't pass an
 * explicit `Payable.dueDate`, derive `documentDate + Supplier.paymentTermsDays`.
 * No due date when there is no supplier, or when the supplier's
 * `paymentTermsDays` is `0` (COD/no terms). Mirrors `deriveSaleDueDate`
 * (`sales/domain/due-date.ts`, RAKHAL-364) exactly, on the payable side of
 * the books.
 */
export function derivePayableDueDate(
  documentDate: Date,
  paymentTermsDays: number | null | undefined,
): Date | null {
  if (!paymentTermsDays || paymentTermsDays <= 0) {
    return null;
  }
  const due = new Date(documentDate);
  due.setUTCDate(due.getUTCDate() + paymentTermsDays);
  return due;
}
