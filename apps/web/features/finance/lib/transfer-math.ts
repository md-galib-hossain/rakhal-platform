/**
 * RAKHAL-356 — pure fee/total computation for the Transfer form, extracted standalone so it's
 * unit-testable without mounting the form (same "exported standalone specifically for testing"
 * precedent as `components/shared/money-input.tsx#parseMoneyInput`).
 *
 * The design brief: "Show computed 'you'll pay X + fee Y = Z total debited from source' before
 * submit." `amount` is what lands in the destination account; `feeAmount` (optional, defaults to 0)
 * is charged on top and posts to the Transfer Fee Expense ledger account (`FINANCE_V2_DESIGN.md`
 * §4.4 chart of accounts) — so the **source** account is debited `amount + feeAmount`, never just
 * `amount`.
 */
export interface TransferTotal {
  amount: number;
  fee: number;
  /** `amount + fee` — the real amount debited from the source account. */
  totalDebited: number;
}

export function computeTransferTotal(amount: number | undefined, feeAmount: number | undefined): TransferTotal {
  const safeAmount = amount != null && Number.isFinite(amount) && amount > 0 ? amount : 0;
  // A fee only means anything alongside a real (positive) amount — a preview with no amount yet
  // shouldn't show a lone fee as if it were already a debit.
  const safeFee = safeAmount > 0 && feeAmount != null && Number.isFinite(feeAmount) && feeAmount > 0 ? feeAmount : 0;
  return { amount: safeAmount, fee: safeFee, totalDebited: safeAmount + safeFee };
}
