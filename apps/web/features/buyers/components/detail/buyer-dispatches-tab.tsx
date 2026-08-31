"use client"; // paged query

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { useDispatchesPagedList } from "../../hooks/use-buyers";
import type { Dispatch, DispatchStatus } from "../../types";

const STATUS_VARIANT: Record<DispatchStatus, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

/** RAKHAL-389 — buyer detail "Dispatches" tab: this buyer's own dispatch history, off
 * `GET /milk/dispatch?buyerId=` (same underlying `BuyerService.listDispatches` call the Sales →
 * Dispatches screen's `GET /buyers/dispatches` v2 route uses, RAKHAL-378) — the per-buyer tab the
 * AC keeps here, distinct from the global Dispatch History that moved to Sales (RAKHAL-388). */
export function BuyerDispatchesTab({ buyerId }: { buyerId: string }) {
  const t = useTranslations("buyers.detail.dispatches");
  const query = useDispatchesPagedList({ buyerId });

  const columns = useMemo<ColumnDef<Dispatch, unknown>[]>(
    () => [
      { id: "dispatchNo", header: t("dispatchNo"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.dispatchNumber}</span> },
      { id: "date", header: t("date"), cell: ({ row }) => <DateText date={row.original.dispatchedAt} /> },
      {
        id: "volume",
        header: t("volume"),
        cell: ({ row }) => `${row.original.volumeReceivedL ?? row.original.volumeDispatchedL} L`,
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`statusOptions.${row.original.status}`)}</Badge>,
      },
      { id: "driver", header: t("driver"), cell: ({ row }) => row.original.driverName ?? "—" },
      { id: "amount", header: t("amount"), cell: ({ row }) => <MoneyText amount={row.original.calculatedAmount} /> },
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
