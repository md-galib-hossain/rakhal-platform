"use client"; // paged query

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { PaymentStatusBadge } from "@/features/finance/components/payments/payment-status-badge";
import { useBuyerInvoicesPagedList } from "../../hooks/use-buyers";
import type { BuyerInvoiceRow } from "../../types";

/** RAKHAL-389 — buyer detail "Sales & Invoices" tab, off `GET /sales?customerId=` (RAKHAL-368's
 * v2 `ListSalesQueryDto`, which already supports `customerId`). Reuses `PaymentStatusBadge`
 * (`features/finance/**`, read-only cross-feature import) for the same 4-state status chip every
 * other invoice/receivable list in the app uses — never a second status-color mapping. */
export function BuyerSalesTab({ buyerId }: { buyerId: string }) {
  const t = useTranslations("buyers.detail.sales");
  const query = useBuyerInvoicesPagedList(buyerId);

  const columns = useMemo<ColumnDef<BuyerInvoiceRow, unknown>[]>(
    () => [
      { id: "invoiceNo", header: t("invoiceNo"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.saleNumber}</span> },
      { id: "date", header: t("date"), cell: ({ row }) => <DateText date={row.original.saleDate} /> },
      {
        id: "totalAmount",
        header: t("totalAmount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} className="font-medium" />,
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <PaymentStatusBadge status={row.original.paymentStatus} />,
      },
      {
        id: "dueDate",
        header: t("dueDate"),
        cell: ({ row }) => (row.original.dueDate ? <DateText date={row.original.dueDate} /> : <span className="text-muted-foreground">—</span>),
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
        <DataTable
          columns={columns}
          data={query.items}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyState={{ title: t("emptyTitle"), description: t("emptyDescription") }}
        />
      </div>
      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={query.goToPage}
        isFetching={query.isFetching}
        pageSize={query.pageSize}
        onPageSizeChange={query.setPageSize}
      />
    </div>
  );
}
