"use client"; // infinite query + column defs + void dialog state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { VoidDocumentDialog, type VoidDocumentVariant } from "@/features/finance/components/void-document-dialog";
import { useCancelSale, useInvoicesList, useRefundSale } from "../../hooks/use-sales";
import type { InvoiceListFilters, InvoicePaymentStatus, InvoiceRow } from "../../types";

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
 * table in this milestone uses. A Sale with no `Receivable` is `PAID` by definition and renders "—"
 * in Due Date (`SaleListRow.paymentStatus`/`dueDate` — server-derived, never recomputed client-side). */
export function InvoicesTable({ filters }: { filters: InvoiceListFilters }) {
  const t = useTranslations("sales.invoices.table");
  const query = useInvoicesList(filters);
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const cancelSale = useCancelSale();
  const refundSale = useRefundSale();
  const [voidTarget, setVoidTarget] = useState<InvoiceRow | null>(null);

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
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Badge variant={STATUS_VARIANT[row.original.paymentStatus]}>{t(`statusOptions.${row.original.paymentStatus}`)}</Badge>
            {VOIDED_STATUSES.includes(row.original.status) ? <Badge variant="destructive">{t("voided")}</Badge> : null}
          </div>
        ),
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
          VOIDED_STATUSES.includes(row.original.status) ? null : (
            <Can I="finance.reverse">
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidTarget(row.original)}>
                {Number(row.original.paidAmount) > 0 ? t("refund") : t("cancel")}
              </Button>
            </Can>
          ),
      },
    ],
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
          emptyState={{ title: t("emptyTitle"), description: t("emptyDescription") }}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </div>

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
