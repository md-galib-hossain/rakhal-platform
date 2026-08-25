/**
 * Derived-only status for a `Receivable` (RAKHAL-340, `FINANCE_V2_DESIGN.md`
 * §4.6). **Not a database column** — `Receivable` (`prisma/schemas/finance-v2/
 * receivable.prisma`) intentionally has no `status` field. This enum exists
 * purely for the TypeScript/API response shape `ReceivableService.getStatus`
 * returns; nothing ever writes it to Postgres.
 *
 * Derivation rule (`FINANCE_V2_DESIGN.md` §4.6):
 *   allocated == 0            -> UNPAID
 *   0 < allocated < total     -> PARTIALLY_PAID
 *   allocated >= total        -> PAID
 *   past dueDate && not PAID  -> OVERDUE  (takes priority over UNPAID/PARTIALLY_PAID)
 */
export enum ReceivableStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}
