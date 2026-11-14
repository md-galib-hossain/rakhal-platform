/**
 * Sale document numbering (RAKHAL-339, Sales — `FINANCE_V2_DESIGN.md` §5.1).
 *
 * Pure formatting only — no Prisma/framework dependency (domain layer). The actual
 * atomic allocation lives in `infrastructure/sale-number.allocator.ts`, which uses
 * these helpers to turn the `FarmCounter` value it reads into a document number.
 *
 * **Format judgment call**: `INV-NNNNNN` (6-digit zero-padded, single continuous
 * per-farm sequence, never resets). Mirrors `formatInvoiceNumber`
 * (`src/modules/billing/domain/invoice-number.ts`, `INV-NNNNNN`) rather than
 * `FarmService`'s year-scoped `PREFIX-YEAR-SERIAL` farm-code format — a sale number
 * is a per-farm transaction reference like an invoice, not a farm identity, so the
 * invoice precedent is the closer fit. Scoped per farm (`sale:<farmId>`, not
 * per-farm-per-year) since nothing in the design doc calls for a fiscal-year reset.
 *
 * **RAKHAL-368 (MILESTONE 22)** — prefix flipped `SALE`→`INV`: the Sale *is*
 * the invoice (`BUSINESS_IA_PRD.md` §7.5's own locked decision — no separate
 * `Invoice` model). No schema change, no new column, no second counter — the
 * `FarmCounter` scope stays `sale:<farmId>` (below) so numbering does not
 * restart, and every existing `SALE-NNNNNN` row keeps its stored number and
 * renders unchanged; only sales created after this ticket get `INV-`.
 */

export const SALE_NUMBER_PREFIX = 'INV';

/** `FarmCounter.scope` for a farm's sale-number sequence. */
export function saleCounterScope(farmId: string): string {
  return `sale:${farmId}`;
}

/** Formats a counter value into a human-readable sale number, e.g. `INV-000123`. */
export function formatSaleNumber(value: number): string {
  return `${SALE_NUMBER_PREFIX}-${String(value).padStart(6, '0')}`;
}
