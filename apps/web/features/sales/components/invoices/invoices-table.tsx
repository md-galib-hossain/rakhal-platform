"use client"; // infinite query + column defs + void dialog state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MobileRecordCard } from "@/components/shared/mobile-record-card";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { VoidDocumentDialog, type VoidDocumentVariant } from "@/features/finance/components/void-document-dialog";
import { useCancelSale, useInvoicesList, useRefundSale } from "../../hooks/use-sales";
import type { InvoiceListFilters, InvoicePaymentStatus, InvoiceRow } from "../../types";
import { NewSaleMenu } from "../new-sale-menu";
import { InvoiceDetailSheet } from "./invoice-detail-sheet";
import { InvoiceReceiveDialog } from "./invoice-receive-dialog";

const STATUS_VARIANT: Record<InvoicePaymentStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

const VOIDED_STATUSES: InvoiceRow["status"][] = ["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"];

/** RAKHAL-388/392 — the AC's exact column set: `Invoice No | Date | Buyer | Total Amount | Paid
 * Amount | Due Amount | Status | Due Date`, plus (RAKHAL-392) a document-level `Voided` badge next
 * to the payment-status one, and a row action to Cancel (unpaid, `paidAmount === 0`) or Refund
 * (paid) — the same `finance.reverse`-gated, void-only correction mechanism every other document
 * table in this milestone uses. Business UX Phase 5 adds a **Receive payment** row action (`finance.create`,
 * while `dueAmount > 0`), a row click that opens `InvoiceDetailSheet`, and `MobileRecordCard`s below `sm`.
 * A Sale with no `Receivable` is `PAID` by definition and renders "—"
 * in Due Date (`SaleListRow.paymentStatus`/`dueDate` — server-derived, never recomputed client-side). */
export function InvoicesTable({ filters }: { filters: InvoiceListFilters }) {
  const t = useTranslations("sales.invoices.table");
  const query = useInvoicesList(filters);
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const cancelSale = useCancelSale();
  const refundSale = useRefundSale();
  const [voidTarget, setVoidTarget] = useState<InvoiceRow | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<InvoiceRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<InvoiceRow | null>(null);

  const isVoided = (row: InvoiceRow) => VOIDED_STATUSES.includes(row.status);
  const canReceive = (row: InvoiceRow) => !isVoided(row) && Number(row.dueAmount) > 0;
  const statusBadges = (row: InvoiceRow) => (
    <>
      <Badge variant={STATUS_VARIANT[row.paymentStatus]}>{t(`statusOptions.${row.paymentStatus}`)}</Badge>
      {isVoided(row) ? <Badge variant="destructive">{t("voided")}</Badge> : null}
    </>
  );

  const voidVariant: VoidDocumentVariant = voidTarget && Number(voidTarget.paidAmount) > 0 ? "refund" : "cancel";

  const columns = useMemo<ColumnDef<InvoiceRow, unknown>[]>(
    () => [
      { id: "invoiceNo", header: t("invoiceNo"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.saleNumber}</span> },
      { id: "date", header: t("date"), cell: ({ row }) => <DateText date={row.original.saleDate} /> },
      { id: "buyer", header: t("buyer"), cell: ({ row }) => row.original.customer?.name ?? t("noBuyer") },
      {
        id: "totalAmount",
        header: t("totalAmount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} className="font-medium" />,
      },
      { id: "paidAmount", header: t("paidAmount"), cell: ({ row }) => <MoneyText amount={Number(row.original.paidAmount)} /> },
      {
        id: "dueAmount",
        header: t("dueAmount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.dueAmount)} colorize={Number(row.original.dueAmount) > 0} />,
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <div className="flex items-center gap-1.5">{statusBadges(row.original)}</div>,
      },
      {
        id: "dueDate",
        header: t("dueDate"),
        cell: ({ row }) => (row.original.dueDate ? <DateText date={row.original.dueDate} /> : <span className="text-muted-foreground">—</span>),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          isVoided(row.original) ? null : (
            <div className="flex items-center gap-1">
              {canReceive(row.original) ? (
                <Can I="finance.create">
                  <Button size="sm" variant="secondary" onClick={() => setReceiveTarget(row.original)}>
                    {t("receivePayment")}
                  </Button>
                </Can>
              ) : null}
              <Can I="finance.reverse">
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidTarget(row.original)}>
                  {Number(row.original.paidAmount) > 0 ? t("refund") : t("cancel")}
                </Button>
              </Can>
            </div>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the helpers above are pure closures over `t`
    [t],
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onRowClick={setDetailTarget}
          emptyState={{ title: t("emptyTitle"), description: t("emptyDescription"), action: <NewSaleMenu /> }}
          renderMobileCard={(row) => (
            <MobileRecordCard
              title={row.saleNumber}
              subtitle={row.customer?.name ?? t("noBuyer")}
              trailing={<MoneyText amount={Number(row.totalAmount)} />}
              badges={statusBadges(row)}
              onOpen={() => setDetailTarget(row)}
              fields={[
                { label: t("date"), value: <DateText date={row.saleDate} /> },
                { label: t("dueAmount"), value: <MoneyText amount={Number(row.dueAmount)} colorize={Number(row.dueAmount) > 0} /> },
              ]}
              actions={
                isVoided(row) ? undefined : (
                  <>
                    {canReceive(row) ? (
                      <Can I="finance.create">
                        <Button size="sm" variant="secondary" onClick={() => setReceiveTarget(row)}>
                          {t("receivePayment")}
                        </Button>
                      </Can>
                    ) : null}
                    <Can I="finance.reverse">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidTarget(row)}>
                        {Number(row.paidAmount) > 0 ? t("refund") : t("cancel")}
                      </Button>
                    </Can>
                  </>
                )
              }
            />
          )}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </div>

      <InvoiceDetailSheet
        invoice={detailTarget}
        open={detailTarget !== null}
        onOpenChange={(open) => !open && setDetailTarget(null)}
        onReceive={(invoice) => {
          setDetailTarget(null);
          setReceiveTarget(invoice);
        }}
        onVoid={(invoice) => {
          setDetailTarget(null);
          setVoidTarget(invoice);
        }}
      />

      <InvoiceReceiveDialog invoice={receiveTarget} open={receiveTarget !== null} onOpenChange={(open) => !open && setReceiveTarget(null)} />

      <VoidDocumentDialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        variant={voidVariant}
        documentLabel={voidTarget?.saleNumber ?? ""}
        onConfirm={() => (voidVariant === "refund" ? refundSale.mutateAsync(voidTarget!.id) : cancelSale.mutateAsync(voidTarget!.id))}
      />
    </>
  );
}
