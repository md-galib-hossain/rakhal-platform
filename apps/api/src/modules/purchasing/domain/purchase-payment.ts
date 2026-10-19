import { PayableStatus } from './payable-status';

/** What `derivePurchasePayment` needs from a purchase's `Payable` (null = none was raised). */
export interface PurchasePayableFigures {
  totalAmount: string | number;
  dueDate: Date | null;
}

export interface PurchasePayment {
  /** `null` for a VOIDED purchase — it is neither owed nor paid. */
  paymentStatus: PayableStatus | null;
  /** Still owed to the supplier, 2-dp string. `'0.00'` when settled or voided. */
  outstanding: string;
  /** Total minus outstanding (what has left the farm so far), 2-dp string. `'0.00'` when voided. */
  paidAmount: string;
}

const cents = (v: string | number): number => Math.round(Number(v) * 100);
const fmt = (c: number): string => (c / 100).toFixed(2);

/**
 * Purchase-level payment state for list rows, derived server-side so the client never has to match a
 * purchase against a separate `payables` page (which silently shows "Paid in full" for any purchase
 * outside that page). Same rule as `PayableService.deriveStatus` — a `Payable` holds only the unpaid
 * remainder at creation, so status follows its allocations; a purchase with no `Payable` was paid in
 * full when it was recorded. Pure.
 *
 * @param totalAmount the purchase total
 * @param voided the purchase is VOIDED
 * @param payable the purchase's payable, or null
 * @param allocated sum of `PaymentAllocation.amount` against that payable
 */
export function derivePurchasePayment(
  totalAmount: string | number,
  voided: boolean,
  payable: PurchasePayableFigures | null,
  allocated: string | number,
  now: Date = new Date(),
): PurchasePayment {
  const total = cents(totalAmount);
  if (voided) {
    return { paymentStatus: null, outstanding: fmt(0), paidAmount: fmt(0) };
  }
  if (!payable) {
    return {
      paymentStatus: PayableStatus.PAID,
      outstanding: fmt(0),
      paidAmount: fmt(total),
    };
  }

  const owedAtCreation = cents(payable.totalAmount);
  const allocatedC = cents(allocated);
  const outstanding = Math.max(owedAtCreation - allocatedC, 0);

  let status: PayableStatus;
  if (outstanding === 0) {
    status = PayableStatus.PAID;
  } else if (payable.dueDate && payable.dueDate.getTime() < now.getTime()) {
    status = PayableStatus.OVERDUE;
  } else if (allocatedC === 0) {
    status = PayableStatus.UNPAID;
  } else {
    status = PayableStatus.PARTIALLY_PAID;
  }

  return {
    paymentStatus: status,
    outstanding: fmt(outstanding),
    paidAmount: fmt(total - outstanding),
  };
}
