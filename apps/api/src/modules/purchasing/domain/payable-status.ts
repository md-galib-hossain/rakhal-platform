/**
 * Derived-only status for a `Payable` (RAKHAL-348, `FINANCE_V2_DESIGN.md`
 * §4.6, §5.1). **Not a database column** — `Payable`
 * (`prisma/schemas/purchasing/payable.prisma`) intentionally has no `status`
 * field, mirroring `ReceivableStatus`
 * (`finance-v2/receivables/domain/receivable-status.ts`, RAKHAL-340) exactly.
 * This enum exists purely for the TypeScript/API response shape
 * `PayableService.getStatus` returns; nothing ever writes it to Postgres.
 *
 * Derivation rule (`FINANCE_V2_DESIGN.md` §4.6):
 *   allocated == 0            -> UNPAID
 *   0 < allocated < total     -> PARTIALLY_PAID
 *   allocated >= total        -> PAID
 *   past dueDate && not PAID  -> OVERDUE  (takes priority over UNPAID/PARTIALLY_PAID)
 */
export enum PayableStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}
