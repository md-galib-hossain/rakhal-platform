"use client"; // finds the invoice's receivable on demand and opens the shared Receive Payment sheet

import { useMemo } from "react";
import { ReceivePaymentDialog } from "@/features/finance/components/payments/receive-payment-dialog";
import type { Receivable } from "@/features/finance/types-v2";
import { useReceivableForSale } from "../../hooks/use-sales";
import type { InvoiceRow } from "../../types";

/**
 * "Receive payment" on an invoice row. A list row carries the derived `dueAmount`/`paymentStatus` but not
 * the `Receivable` id `ReceivePaymentDialog` settles against, so it is looked up by `saleId` while the
 * dialog is open (`salesApi.findReceivableBySale`). The amount offered is the row's server-derived
 * `dueAmount`; a sale paid in full at the time has no receivable, so the dialog never opens for it.
 */
export function InvoiceReceiveDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lookup = useReceivableForSale(open ? invoice?.id : undefined);

  const receivable = useMemo<Receivable | null>(() => {
    const found = lookup.data;
    if (!invoice || !found) return null;
    return {
      id: found.id,
      farmId: found.farmId,
      saleId: found.saleId,
      customerId: found.customerId,
      totalAmount: String(found.totalAmount),
      dueDate: found.dueDate,
      closedAt: found.closedAt,
      createdAt: "",
      outstanding: invoice.dueAmount,
      status: invoice.paymentStatus,
    };
  }, [lookup.data, invoice]);

  return <ReceivePaymentDialog receivable={receivable} open={open && receivable != null} onOpenChange={onOpenChange} />;
}
