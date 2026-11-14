"use client"; // fan-out payment-detail fetch + sheet state

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent } from "@rakhal/ui/ui/sheet";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { usePaymentHistory, useFinancialAccounts } from "../../hooks/use-finance-v2";
import { PaymentStatusBadge } from "./payment-status-badge";
import type { Payable, Receivable, SettlementStatusV2 } from "../../types-v2";

/**
 * RAKHAL-358 — Payment History for one Receivable/Payable. Proves the design doc's "multiple
 * payments per document, across different accounts" claim visibly: every payment allocated to this
 * document, oldest first, each row showing the account it hit and the running outstanding balance
 * right after it — so a farmer scanning down the list can see the balance actually decreasing
 * payment-by-payment rather than jumping straight to a final number. Backed by `usePaymentHistory`
 * (see that hook's own doc comment for the documented N+1 fan-out this needs, given the backend has
 * no `receivableId`/`payableId` filter on `GET /finance/payments` yet).
 */
export function PaymentHistorySheet({
  kind,
  document,
  open,
  onOpenChange,
}: {
  kind: "RECEIVABLE" | "PAYABLE";
  document: Receivable | Payable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("finance.settlementsV2.paymentHistory");
  const tMethods = useTranslations("finance.settlementsV2.methodOptions");
  const { rows, isLoading, isError } = usePaymentHistory(kind, document?.id);
  const { data: accounts } = useFinancialAccounts();
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const totalAmount = document ? Number(document.totalAmount) : 0;

  // Precomputed once per `rows`/`totalAmount` change (not mutated during JSX render) — each row
  // carries the running-outstanding balance immediately after it, oldest-first.
  const rowsWithRunningOutstanding = useMemo(() => {
    type HistoryRow = (typeof rows)[number];
    return rows.reduce<{ acc: (HistoryRow & { runningOutstanding: number })[]; paidSoFar: number }>(
      (state, row) => {
        const paidSoFar = state.paidSoFar + row.amount;
        return { acc: [...state.acc, { ...row, runningOutstanding: Math.max(totalAmount - paidSoFar, 0) }], paidSoFar };
      },
      { acc: [], paidSoFar: 0 },
    ).acc;
  }, [rows, totalAmount]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>

          {document ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("documentTotal")}</span>
                <MoneyText amount={totalAmount} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("currentOutstanding")}</span>
                <span className="flex items-center gap-2">
                  <MoneyText amount={Number(document.outstanding)} />
                  <PaymentStatusBadge status={document.status as SettlementStatusV2} />
                </span>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : isError ? (
            <ErrorState />
          ) : rows.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {rowsWithRunningOutstanding.map((row) => {
                const account = accountById.get(row.financialAccountId);
                return (
                  <div key={`${row.paymentId}-${row.financialAccountId}-${row.amount}`} className="flex flex-col gap-1 p-3">
                    <div className="flex items-center justify-between">
                      <DateText date={row.transactionDate} className="text-sm text-foreground" />
                      <MoneyText amount={row.amount} className="text-sm font-medium text-foreground" />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {account?.name ?? row.financialAccountId} · {tMethods(row.method)}
                        {row.referenceNumber ? ` · ${row.referenceNumber}` : ""}
                      </span>
                      <span>
                        {t("runningOutstanding")}: <MoneyText amount={row.runningOutstanding} className="inline" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
