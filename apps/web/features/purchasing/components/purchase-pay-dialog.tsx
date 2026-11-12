"use client"; // loads the purchase's payable on demand and opens the shared Make Payment sheet

import { useMemo } from "react";
import { MakePaymentDialog } from "@/features/finance/components/payments/make-payment-dialog";
import type { Payable } from "@/features/finance/types-v2";
import { usePurchase } from "../hooks/use-purchasing";
import type { PurchaseListRow } from "../types";

/**
 * "Pay" on a purchase row. The list row only carries the derived `outstanding`/`paymentStatus`, not the
 * `Payable` id `MakePaymentDialog` settles against — that comes from `GET /purchasing/purchases/:id`
 * (`payable` embedded), loaded only while the dialog is open. The amount the dialog offers is the row's
 * server-derived `outstanding` (which already nets earlier payments), never recomputed here.
 */
export function PurchasePayDialog({
  purchase,
  open,
  onOpenChange,
}: {
  purchase: PurchaseListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = usePurchase(open ? purchase?.id : undefined);

  const payable = useMemo<Payable | null>(() => {
    const embedded = detail.data?.payable;
    if (!purchase || !embedded) return null;
    return {
      id: embedded.id,
      farmId: embedded.farmId,
      purchaseId: embedded.purchaseId,
      expenseId: null,
      supplierId: embedded.supplierId,
      totalAmount: String(embedded.totalAmount),
      dueDate: embedded.dueDate,
      closedAt: embedded.closedAt,
      createdAt: embedded.createdAt,
      outstanding: purchase.outstanding,
      status: purchase.paymentStatus ?? "UNPAID",
    };
  }, [detail.data, purchase]);

  return <MakePaymentDialog payable={payable} open={open && payable != null} onOpenChange={onOpenChange} />;
}
