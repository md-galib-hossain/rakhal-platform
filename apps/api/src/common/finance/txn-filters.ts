import { Prisma } from '@prisma/client';

/**
 * Where-fragment that excludes void bookkeeping from money totals (RD-017).
 *
 * Voiding a transaction marks the original `isVoided` (status → VOIDED) **and**
 * writes a negative-amount *reversal* row (`COMPLETED`, `reversedTransactionId`
 * set, type copied). A sum that filters only on `status`/`isVoided` still counts
 * the reversal, so a voided expense nets to −amount instead of 0 — corrupting
 * runway, cost-per-litre, P&L, and every other money KPI.
 *
 * Spread this into any aggregation that totals real money. Do **not** use it in
 * audit/ledger *list* views — those should still surface reversals.
 */
export const NON_VOID_TXN = {
  isVoided: false,
  reversedTransactionId: null,
} satisfies Prisma.FinanceTransactionWhereInput;
