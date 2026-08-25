import { FinancePayment, PaymentMethod, Receivable } from '@prisma/client';
import { SaleWithLines } from '../../sale.service';

/**
 * Input for `SellMilkUseCase.execute` (RAKHAL-342, Finance V2 —
 * `FINANCE_V2_DESIGN.md` §1.2, §4.3). Two callers use this today:
 *  - `BuyerService.recordDispatch` — `volumeL`/`pricePerLitre` derived from
 *    the dispatch's own quality-adjusted price breakdown so the posted
 *    `Sale.totalAmount` matches `MilkDispatch.calculatedAmount` exactly;
 *    `amountReceived` always 0 (a dispatch is unpaid at record time, settled
 *    later via the generic `POST /finance/payments` + `/allocations` routes).
 *  - A future direct "Record Sale > Milk" flow (RAKHAL-357, not built by
 *    this ticket) — a walk-up cash/bKash milk sale with no buyer at all.
 */
export interface SellMilkInput {
  /** Litres sold — also the amount decremented from the fullest active
   * SELLABLE `MilkTank`, if one exists for this farm. */
  volumeL: number;
  /** ৳ per litre. `Sale.totalAmount` is `volumeL * pricePerLitre`, computed
   * by `SaleService.createSale` the same way every other sale line is. */
  pricePerLitre: number;
  /** Free-form reference to whoever bought the milk (a `MilkBuyer.id`, or
   * nothing for a walk-up sale) — see `Sale.customerId`'s own doc comment
   * for why this is a plain scalar, not a `@relation`. */
  customerId?: string | null;
  /** ISO date string. Defaults to now. */
  saleDate?: string;
  description?: string;
  notes?: string;
  dueDate?: Date | null;
  /** Money actually received at sale time (0 for a fully-on-credit sale,
   * e.g. every milk dispatch today). Requires `financialAccountId` +
   * `paymentMethod` when greater than zero. */
  amountReceived?: number;
  financialAccountId?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
}

export interface SellMilkResult {
  sale: SaleWithLines;
  receivable: Receivable;
  payment: FinancePayment | null;
  /** Whether an active SELLABLE `MilkTank` existed for this farm and was
   * decremented. `false` is a legitimate no-op (the farm hasn't configured
   * Inventory's milk tank feature yet) — the sale/receivable/journal still
   * post, matching the pre-RAKHAL-342 `sellFromTank` behaviour. */
  tankUpdated: boolean;
}
