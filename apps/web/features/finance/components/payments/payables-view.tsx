"use client"; // dialog/sheet open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pagination } from "@/components/shared/pagination";
import { usePayablesV2PagedList } from "../../hooks/use-finance-v2";
import { AgingSummaryStrip } from "./aging-summary-strip";
import { PayablesTable } from "./payables-table";
import { MakePaymentDialog } from "./make-payment-dialog";
import { PaymentHistorySheet } from "./payment-history-sheet";
import type { Payable } from "../../types-v2";

/** RAKHAL-358 — Payables (V2) tab body. Mirrors `ReceivablesView` exactly on the liability side.
 * Mounted as the `payables` tab inside `FinanceView` since RAKHAL-382. RAKHAL-386 added the
 * `AgingSummaryStrip` + the required "Make Payment settles a bill — it does not create an expense"
 * copy line. */
export function PayablesView() {
  const query = usePayablesV2PagedList({});
  const [paymentTarget, setPaymentTarget] = useState<Payable | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Payable | null>(null);
  const t = useTranslations("finance.settlementsV2.payables");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

      <AgingSummaryStrip kind="PAYABLE" />
      <p className="text-xs text-muted-foreground">{t("settlesBillCopy")}</p>

      <PayablesTable
        items={query.items}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onMakePayment={setPaymentTarget}
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

      <MakePaymentDialog
        payable={paymentTarget}
        open={paymentTarget != null}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
      />

      <PaymentHistorySheet
        kind="PAYABLE"
        document={historyTarget}
        open={historyTarget != null}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
      />
    </div>
  );
}
