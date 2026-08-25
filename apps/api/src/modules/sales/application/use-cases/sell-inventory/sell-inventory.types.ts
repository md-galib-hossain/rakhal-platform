import { FinancePayment, PaymentMethod, Receivable } from '@prisma/client';
import { SaleWithLines } from '../../sale.service';

/** Which inventory table `SellInventoryUseCase` draws stock from. Mirrors
 * `InventorySaleLine`'s three-nullable-FK shape (RAKHAL-339) — exactly one
 * table is touched per call. */
export type SellInventoryItemType = 'MEDICINE' | 'FEED_ITEM' | 'EQUIPMENT';

/**
 * Input to `SellInventoryUseCase.execute` (RAKHAL-346, `FINANCE_V2_DESIGN.md`
 * §5.2). No presentation-layer DTO exists yet — this ticket's own lane is
 * `application/use-cases/sell-inventory/**` only; the HTTP surface (a
 * `POST /sales/inventory`-shaped route validating this same shape with
 * class-validator) is a later ticket's concern (RAKHAL-357, "Record Sale
 * flow"), same judgment call RAKHAL-344 (`CattleDisposition`) documents for
 * its own service-only, no-controller-yet scope.
 */
export interface SellInventoryItemInput {
  itemType: SellInventoryItemType;
  /** The `Medicine`/`FeedItem`/`Equipment` row id, matching `itemType`. */
  itemId: string;
  /** Quantity sold, in the item's own stock unit. Must not exceed stock on hand. */
  quantity: number;
  /** Price per unit sold, `>= 0`. */
  unitPrice: number;
  discountAmount?: number;
  notes?: string;
  /** ISO date string — the `Sale`'s and `FinancePayment`'s transaction date. */
  saleDate: string;
  /** Required (together with `paymentMethod`) whenever `amountReceived > 0`. */
  financialAccountId?: string;
  /** Amount collected at sale time, `>= 0`, never more than the sale total.
   * `0`/`undefined` leaves the sale fully unpaid (a pure `Receivable`, no
   * `Payment`). Equal to the total pays it off in full; anything in between
   * is a partial payment — `Receivable`'s own derived status
   * (UNPAID/PARTIALLY_PAID/PAID) reflects which, never a field this method sets. */
  amountReceived?: number;
  paymentMethod?: PaymentMethod;
}

export interface SellInventoryItemResult {
  sale: SaleWithLines;
  receivable: Receivable;
  payment: FinancePayment | null;
}
