"use client"; // dialog/sheet open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pagination } from "@/components/shared/pagination";
import { useReceivablesV2PagedList } from "../../hooks/use-finance-v2";
import { AgingSummaryStrip } from "./aging-summary-strip";
import { ReceivablesTable } from "./receivables-table";
import { ReceivePaymentDialog } from "./receive-payment-dialog";
import { PaymentHistorySheet } from "./payment-history-sheet";
import type { Receivable } from "../../types-v2";

/**
 * RAKHAL-358 — Receivables (V2) tab body: `finance.read`-gated list (`<Can>` lives inside
 * `ReceivablesTable`'s own "Receive Payment" action cell), cursor pagination via `useCursorPager`
 * (per house convention, same adapter V1's `ReceivablesView` uses), and the Receive Payment /
 * Payment History flows wired to the row that triggered them. Mounted as the `receivables` tab
 * inside `FinanceView` since RAKHAL-382. RAKHAL-386 added the `AgingSummaryStrip` + the required
 * "Receive Payment settles an invoice — it does not create a sale" copy line.
 */
export function ReceivablesView() {
  const query = useReceivablesV2PagedList({});
  const [paymentTarget, setPaymentTarget] = useState<Receivable | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Receivable | null>(null);
  const t = useTranslations("finance.settlementsV2.receivables");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

      <AgingSummaryStrip kind="RECEIVABLE" />
      <p className="text-xs text-muted-foreground">{t("settlesInvoiceCopy")}</p>

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

      <ReceivePaymentDialog
        receivable={paymentTarget}
        open={paymentTarget != null}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
      />

      <PaymentHistorySheet
        kind="RECEIVABLE"
        document={historyTarget}
        open={historyTarget != null}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
      />
    </div>
  );
}
