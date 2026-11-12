"use client"; // dialog/sheet open state

import { useState } from "react";
import { Pagination } from "@/components/shared/pagination";
import { useReceivablesV2PagedList } from "@/features/finance/hooks/use-finance-v2";
import { ReceivablesTable } from "@/features/finance/components/payments/receivables-table";
import { ReceivePaymentDialog } from "@/features/finance/components/payments/receive-payment-dialog";
import { PaymentHistorySheet } from "@/features/finance/components/payments/payment-history-sheet";
import type { Receivable } from "@/features/finance/types-v2";

/** RAKHAL-389 — buyer detail "Payments" tab: this buyer's own Receivables (invoice, total,
 * outstanding, status), with the same Receive Payment / Payment History actions the Finance →
 * Receivables screen offers. Reuses `features/finance/**`'s existing components/hooks as-is
 * (`useReceivablesV2PagedList({customerId})`, `ListReceivablesFilters` already supports it) —
 * read-only cross-feature reuse, no edits to `features/finance/**`, same precedent Purchasing's
 * `ItemPicker` reuse in Sales already established this milestone. */
export function BuyerPaymentsTab({ buyerId }: { buyerId: string }) {
  const query = useReceivablesV2PagedList({ customerId: buyerId });
  const [paymentTarget, setPaymentTarget] = useState<Receivable | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Receivable | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ReceivablesTable
        items={query.items}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onReceivePayment={setPaymentTarget}
        onViewHistory={setHistoryTarget}
      />

      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={query.goToPage}
        isFetching={query.isFetching}
        pageSize={query.pageSize}
        onPageSizeChange={query.setPageSize}
      />

      <ReceivePaymentDialog receivable={paymentTarget} open={paymentTarget != null} onOpenChange={(open) => !open && setPaymentTarget(null)} />
      <PaymentHistorySheet kind="RECEIVABLE" document={historyTarget} open={historyTarget != null} onOpenChange={(open) => !open && setHistoryTarget(null)} />
    </div>
  );
}
