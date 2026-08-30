"use client"; // live period-scoped query

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { MoneyText } from "@/components/shared/money-text";
import type { PeriodRange } from "@/lib/period/presets";
import { useCashFlowReport } from "./hooks";
import type { CashFlowAccountLine } from "./types";

/** RAKHAL-387 — Cash Flow report: opening/inflow/outflow/closing per `FinancialAccount`, plus a
 * totals footer row. Un-paginated (`accounts[]` is bounded by the farm's own account count, same
 * "small list" precedent `AccountList`/`RakhalBalanceCard` already use). */
export function CashFlowReportView({ range }: { range: PeriodRange }) {
  const t = useTranslations("finance.reportsV2.cashFlow");
  const query = useCashFlowReport(range);

  const columns = useMemo<ColumnDef<CashFlowAccountLine, unknown>[]>(
    () => [
      {
        id: "name",
        header: t("columns.account"),
        cell: ({ row }) => <span className="text-sm font-medium text-foreground">{row.original.name}</span>,
      },
      {
        id: "opening",
        header: t("columns.opening"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.openingBalance)} />,
      },
      {
        id: "inflow",
        header: t("columns.inflow"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.inflow)} colorize className="text-success" />,
      },
      {
        id: "outflow",
        header: t("columns.outflow"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.outflow)} className="text-destructive" />,
      },
      {
        id: "closing",
        header: t("columns.closing"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.closingBalance)} className="font-medium" />,
      },
    ],
    [t],
  );

  const data = query.data;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
        <DataTable
          columns={columns}
          data={data?.accounts ?? []}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyState={{ title: t("empty.title"), description: t("empty.description") }}
        />
      </div>
      {data ? (
        <div className="flex flex-wrap items-center justify-end gap-4 rounded-xl bg-muted p-3 text-sm">
          <span className="text-muted-foreground">{t("totalClosing")}</span>
          <MoneyText amount={Number(data.totals.closingBalance)} colorize className="text-base font-bold" />
        </div>
      ) : null}
    </div>
  );
}
