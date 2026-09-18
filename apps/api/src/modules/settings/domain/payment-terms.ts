/** RD-068: `Supplier.paymentTerms` (free text, e.g. `cod`/`net_7`/`net_30`) and
 * `Supplier.paymentTermsDays` (numeric, drives `Payable.dueDate` derivation in
 * `PurchaseService`/`ExpenseService`) used to be two independently-writable fields that could
 * silently disagree — `paymentTermsDays` had no write path at all and stayed `0` forever.
 *
 * Rather than add a second user-facing numeric input farms must keep in sync by hand (which
 * would just move the disagreement risk into the UI), `paymentTermsDays` is derived from
 * `paymentTerms` on every write, so the free-text field the Settings form already edits stays
 * the single source of truth. Recognizes `cod` (0 days) and `net_<N>`/`net<N>` (N days,
 * case-insensitive, matching the only shapes seen in seed + live data); anything else falls
 * back to `0` (COD/no terms) rather than guessing.
 */
export function parsePaymentTermsDays(text: string | null | undefined): number {
  if (!text) {
    return 0;
  }
  const trimmed = text.trim().toLowerCase();
  if (trimmed === 'cod') {
    return 0;
  }
  const match = /^net[_-]?(\d+)$/.exec(trimmed);
  return match ? parseInt(match[1], 10) : 0;
}
