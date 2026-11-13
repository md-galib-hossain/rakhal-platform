"use client"; // receivable lookup + payment-history fan-out + sheet state

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightToLine, Ban, Banknote } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { useFinancialAccounts, usePaymentHistory } from "@/features/finance/hooks/use-finance-v2";
import { useReceivableForSale } from "../../hooks/use-sales";
import type { InvoicePaymentStatus, InvoiceRow } from "../../types";

const STATUS_VARIANT: Record<InvoicePaymentStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

const VOIDED_STATUSES: InvoiceRow["status"][] = ["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"];

/**
 * Invoice detail — opened by clicking an Invoices row (or an invoice number elsewhere). Shows who it
 * was sold to (a link to the buyer's page), what was sold, the server-derived total / paid / due and
 * the payments taken against it, oldest first. Actions: **Receive payment** (`finance.create`, while
 * something is due) and **Cancel / Refund** (`finance.reverse`, the same void mechanism the table's row
 * action uses). Cross-links go to the Dispatches tab (milk sales), Finance receivables and the Activity
 * Log. The payments come from the sale's `Receivable` (`useReceivableForSale`); a sale paid in full on
 * the spot has none, which the sheet says outright instead of showing an empty list.
 */
export function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
  onReceive,
  onVoid,
}: {
  invoice: InvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceive: (invoice: InvoiceRow) => void;
  onVoid: (invoice: InvoiceRow) => void;
}) {
  const t = useTranslations("sales.invoices.detailSheet");
  const tTable = useTranslations("sales.invoices.table");
  const tLineType = useTranslations("sales.overview.byProduct.lineType");
  const tMethods = useTranslations("finance.settlementsV2.methodOptions");
  const receivable = useReceivableForSale(open ? invoice?.id : undefined);
  // `usePaymentHistory` has no per-document endpoint behind it: it loads every payment, then each one's
  // allocations (one request each). Run it only when the user asks, never just by opening the sheet.
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const wantHistory = open && invoice != null && historyFor === invoice.id;
  const history = usePaymentHistory("RECEIVABLE", wantHistory ? receivable.data?.id : undefined);
  const { data: accounts } = useFinancialAccounts();
  const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const voided = invoice ? VOIDED_STATUSES.includes(invoice.status) : false;
  const due = invoice ? Number(invoice.dueAmount) : 0;
  const lineType = invoice?.lineSummary.type;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showClose={false}
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-lg sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{invoice?.saleNumber ?? t("title")}</SheetTitle>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70">
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <SheetDescription className="sr-only">{t("description")}</SheetDescription>
        <div className="border-t border-dashed border-border" />

        {invoice ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={STATUS_VARIANT[invoice.paymentStatus]}>{tTable(`statusOptions.${invoice.paymentStatus}`)}</Badge>
              {voided ? <Badge variant="destructive">{tTable("voided")}</Badge> : null}
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("buyer")}</dt>
                <dd>
                  {invoice.customer ? (
                    <Link href={`/buyers/${invoice.customer.id}`} className="font-medium text-primary hover:underline">
                      {invoice.customer.name}
                    </Link>
                  ) : (
                    <span className="text-foreground">{tTable("noBuyer")}</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("date")}</dt>
                <dd>
                  <DateText date={invoice.saleDate} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("total")}</dt>
                <dd>
                  <MoneyText amount={Number(invoice.totalAmount)} className="font-semibold" />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("paid")}</dt>
                <dd>
                  <MoneyText amount={Number(invoice.paidAmount)} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("due")}</dt>
                <dd>
                  <MoneyText amount={due} colorize={due > 0} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("dueDate")}</dt>
                <dd>{invoice.dueDate ? <DateText date={invoice.dueDate} /> : "—"}</dd>
              </div>
            </dl>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("sold")}</h3>
              <p className="rounded-xl border border-border px-4 py-3 text-sm text-foreground">
                {lineType ? tLineType(lineType) : "—"}
                {invoice.lineSummary.description ? ` · ${invoice.lineSummary.description}` : ""}
                {invoice.lineSummary.quantity ? ` · ${invoice.lineSummary.quantity}` : ""}
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("payments")}</h3>
              {receivable.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : !receivable.data ? (
                <p className="text-sm text-muted-foreground">{t("paidAtSale")}</p>
              ) : !wantHistory ? (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setHistoryFor(invoice.id)}>
                  {t("showPayments")}
                </Button>
              ) : history.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : history.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {history.rows.map((row) => (
                    <div key={`${row.paymentId}-${row.amount}`} className="flex items-center justify-between gap-3 p-3">
                      <div className="flex flex-col gap-0.5">
                        <DateText date={row.transactionDate} className="text-sm text-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {accountName.get(row.financialAccountId) ?? ""} {tMethods(row.method)}
                          {row.referenceNumber ? ` · ${row.referenceNumber}` : ""}
                        </span>
                      </div>
                      <MoneyText amount={row.amount} className="text-sm font-medium" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-3 text-sm">
              {lineType === "MILK" ? (
                <Link href="/sales?tab=dispatches" className="font-medium text-primary hover:underline">
                  {t("viewDispatches")}
                </Link>
              ) : null}
              <Link href="/finance?tab=receivables" className="font-medium text-primary hover:underline">
                {t("viewFinance")}
              </Link>
              <Link href="/activity" className="font-medium text-primary hover:underline">
                {t("viewActivity")}
              </Link>
            </div>
          </div>
        ) : null}

        {invoice && !voided ? (
          <>
            <div className="border-t border-dashed border-border" />
            <div className="flex gap-3 pt-5">
              <Can I="finance.reverse">
                <Button type="button" variant="outline" className="h-12 flex-1 text-destructive hover:text-destructive" onClick={() => onVoid(invoice)}>
                  <Ban className="mr-1.5 size-4" aria-hidden />
                  {Number(invoice.paidAmount) > 0 ? tTable("refund") : tTable("cancel")}
                </Button>
              </Can>
              {due > 0 ? (
                <Can I="finance.create">
                  <Button type="button" className="h-12 flex-1" onClick={() => onReceive(invoice)}>
                    <Banknote className="mr-1.5 size-4" aria-hidden />
                    {t("receivePayment")}
                  </Button>
                </Can>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
