"use client"; // live query

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@rakhal/ui/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { useRecentInvoices } from "../../hooks/use-sales";
import type { InvoiceRow, InvoicePaymentStatus } from "../../types";

const STATUS_VARIANT: Record<InvoicePaymentStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

/** RAKHAL-388 — "Recent Sales" panel (the invoice number opens that invoice on the Invoices tab, the buyer
 * name opens the buyer's page): `Invoice No | Date | Buyer | Product | Qty | Total Amount |
 * Status | Due Date` (`BUSINESS_IA_PRD.md` §5.7), 5 newest invoices. */
export function RecentSalesTable() {
  const t = useTranslations("sales.overview.recentSales");
  const tLineType = useTranslations("sales.overview.byProduct.lineType");
  const query = useRecentInvoices(5);
  const rows = query.data?.items ?? [];

  const columns = useMemo<ColumnDef<InvoiceRow, unknown>[]>(
    () => [
      {
        id: "saleNumber",
        header: t("invoiceNo"),
        cell: ({ row }) => (
          <Link
            href={`/sales?tab=invoices&preset=this_year&invoice=${encodeURIComponent(row.original.saleNumber)}`}
            className="font-mono text-xs font-medium text-primary hover:underline"
          >
            {row.original.saleNumber}
          </Link>
        ),
      },
      { id: "date", header: t("date"), cell: ({ row }) => <DateText date={row.original.saleDate} /> },
      {
        id: "buyer",
        header: t("buyer"),
        cell: ({ row }) =>
          row.original.customer ? (
            <Link href={`/buyers/${row.original.customer.id}`} className="text-primary hover:underline">
              {row.original.customer.name}
            </Link>
          ) : (
            t("noBuyer")
          ),
      },
      {
        id: "product",
        header: t("product"),
        cell: ({ row }) => (row.original.lineSummary.type ? tLineType(row.original.lineSummary.type) : "—"),
      },
      { id: "qty", header: t("qty"), cell: ({ row }) => row.original.lineSummary.quantity || "—" },
      {
        id: "total",
        header: t("totalAmount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} className="font-medium" />,
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.paymentStatus]}>{t(`statusOptions.${row.original.paymentStatus}`)}</Badge>,
      },
      {
        id: "dueDate",
        header: t("dueDate"),
        cell: ({ row }) => (row.original.dueDate ? <DateText date={row.original.dueDate} /> : <span className="text-muted-foreground">—</span>),
      },
    ],
    [t, tLineType],
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <Link href="/sales?tab=invoices" className="text-xs font-medium text-primary hover:underline">
          {t("viewAll")}
        </Link>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-hidden rounded-xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[48px] [&_thead_th]:text-xs [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(row) => row.id}
            isLoading={query.isLoading}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            emptyState={{ title: t("emptyTitle"), description: t("emptyDescription") }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
