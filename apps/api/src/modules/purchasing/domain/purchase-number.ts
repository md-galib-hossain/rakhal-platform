/**
 * Purchase document numbering (RAKHAL-348, Purchasing —
 * `FINANCE_V2_DESIGN.md` §5.1). Pure formatting only — no Prisma/framework
 * dependency (domain layer). Mirrors `sales/domain/sale-number.ts`
 * (RAKHAL-339) exactly: the actual atomic allocation lives in
 * `infrastructure/purchase-number.allocator.ts`, which uses these helpers to
 * turn the `FarmCounter` value it reads into a document number.
 *
 * **Format judgment call**: `PUR-NNNNNN` (6-digit zero-padded, single
 * continuous per-farm sequence, never resets) — same reasoning as
 * `SALE_NUMBER_PREFIX`: a purchase number is a per-farm transaction
 * reference like a sale/invoice number, not a farm identity.
 */

export const PURCHASE_NUMBER_PREFIX = 'PUR';

/** `FarmCounter.scope` for a farm's purchase-number sequence. */
export function purchaseCounterScope(farmId: string): string {
  return `purchase:${farmId}`;
}

/** Formats a counter value into a human-readable purchase number, e.g. `PUR-000123`. */
export function formatPurchaseNumber(value: number): string {
  return `${PURCHASE_NUMBER_PREFIX}-${String(value).padStart(6, '0')}`;
}
