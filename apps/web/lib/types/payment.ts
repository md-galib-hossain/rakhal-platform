import { z } from "zod";

/**
 * RAKHAL-355 — the ONE canonical payment-method type for Finance V2 surfaces (RAKHAL-356+: Record
 * Sale, Payments/Receivables/Payables, Expenses/Purchases). Matches the backend V2 enum exactly —
 * `FINANCE_V2_DESIGN.md` §3 is explicit that `FinancePaymentMethod.WALLET` is deleted in V2 (the
 * "wallet" was never a real account, just an unnamed cash bucket; V2 replaces it with named
 * `FinancialAccount` rows of type CASH/BANK/MFS, so "pay from the wallet" becomes "pay from a
 * specific account" and the payment *method* only needs to say which account family was used).
 *
 * Deliberately placed under `lib/types/` rather than `features/finance/types.ts`: V1's finance
 * module (`features/finance/**`) is frozen (no new features — see `docs/IN_FLIGHT.md`/root
 * `CLAUDE.md`) and its own `FinancePaymentMethod` (`features/finance/types.ts`) still includes
 * `WALLET` because V1's backend routes (`finance.controller.ts`) still accept it — one live flow
 * depends on that exact value being selectable:
 *   - `features/finance/components/{add-funds,withdraw}-dialog.tsx` — the V1 wallet itself.
 * The other two call sites this comment used to list are migrated off V1 payment methods entirely:
 * RAKHAL-393 (closes RD-066) moved `features/reproduction/schemas.ts`'s breeding-event AI costing
 * and `features/feed/components/finalize-tmr-dialog.tsx`'s TMR finalize onto a real
 * `financialAccountId` (`AccountPicker`) — deleting the backend's `resolveFinancialAccountId`
 * "oldest active account of that type" stopgap — so neither posts a bare `paymentMethod` anymore.
 * This file is reserved for the new V2 primitives (`AccountPicker`, and RAKHAL-357's Record Sale /
 * RAKHAL-358's Payments wizard) that post against the new `finance-v2` backend routes, which never
 * accept `WALLET`.
 */
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MFS"] as const;

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
