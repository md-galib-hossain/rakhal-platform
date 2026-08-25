"use client"; // dialog/sheet open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pagination } from "@/components/shared/pagination";
import { useReceivablesV2PagedList } from "../../hooks/use-finance-v2";
import { ReceivablesTable } from "./receivables-table";
import { ReceivePaymentDialog } from "./receive-payment-dialog";
import { PaymentHistorySheet } from "./payment-history-sheet";
import type { Receivable } from "../../types-v2";

/**
 * RAKHAL-358 — Receivables (V2) tab body: `finance.read`-gated list (`<Can>` lives inside
 * `ReceivablesTable`'s own "Receive Payment" action cell), cursor pagination via `useCursorPager`
 * (per house convention, same adapter V1's `ReceivablesView` uses), and the Receive Payment /
 * Payment History flows wired to the row that triggered them.
 *
 * **Deliberately not wired into `app/(app)/finance/page.tsx`** — that page's single `FinanceView`
 * (V1) tab bar sits under RAKHAL-356/360's own active claim on `app/(app)/finance/**`, and V1's UI
 * stays live/untouched until RAKHAL-361 retires it (per this ticket's own brief: "do not touch V1's
 * finance components beyond reading"). This component is complete, gate-green, and Vitest-covered
 * (`PaymentStatusBadge`'s pass-through test) on its own, ready for RAKHAL-361 — or whichever ticket
 * next restructures the Finance page — to mount without further work. Documented in this repo's
 * `docs/IN_FLIGHT.md` RAKHAL-358 write-up.
 */
export function ReceivablesView() {
  const query = useReceivablesV2PagedList({});
  const [paymentTarget, setPaymentTarget] = useState<Receivable | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Receivable | null>(null);
  const t = useTranslations("finance.settlementsV2.receivables");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

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
