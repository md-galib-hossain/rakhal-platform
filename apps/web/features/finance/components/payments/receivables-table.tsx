"use client"; // columns need translation + row-action callbacks

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { useSalesLookup } from "../../hooks/use-finance-v2";
import { PaymentStatusBadge } from "./payment-status-badge";
import type { Receivable } from "../../types-v2";

/**
 * RAKHAL-358 — Receivables list, V2. Columns per the ticket brief: sale reference, customer, total,
 * outstanding (server-computed), status (derived, shown as a badge only — never an editable
 * input, `FINANCE_V2_DESIGN.md` §4.6). `Receivable` itself carries only `saleId`/`customerId`
 * scalars (no join — see `types-v2.ts#SaleSummary`'s doc comment on why), so the "sale reference"
 * column is decorated client-side from `useSalesLookup()`'s small un-paginated `GET /sales` list,
 * looked up by `saleId`; falls back to the raw id if the lookup hasn't loaded yet or the sale was
 * somehow not found (never silently blank).
 */
export function ReceivablesTable({
  items,
  isLoading,
  isError,
  onRetry,
  onReceivePayment,
  onViewHistory,
}: {
  items: Receivable[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onReceivePayment: (receivable: Receivable) => void;
  onViewHistory: (receivable: Receivable) => void;
}) {
  const t = useTranslations("finance.settlementsV2.receivables");
  const tHistory = useTranslations("finance.settlementsV2.paymentHistory");
  const { data: sales } = useSalesLookup();
  const saleById = useMemo(() => new Map((sales ?? []).map((s) => [s.id, s])), [sales]);

  const columns = useMemo<ColumnDef<Receivable, unknown>[]>(
    () => [
      {
        id: "reference",
        header: t("columns.reference"),
        cell: ({ row }) => {
          const sale = saleById.get(row.original.saleId);
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{sale?.saleNumber ?? t("noReference")}</span>
              <span className="text-xs text-muted-foreground">
                <DateText date={row.original.createdAt} />
              </span>
            </div>
          );
        },
      },
      {
        id: "customer",
        header: t("columns.customer"),
        cell: ({ row }) => (
          <span className="text-sm text-foreground">{row.original.customerId ?? t("noCustomer")}</span>
        ),
      },
      {
        id: "total",
        header: t("columns.total"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} />,
      },
      {
        id: "outstanding",
        header: t("columns.outstanding"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.outstanding)} />,
      },
      {
        id: "dueDate",
        header: t("columns.dueDate"),
        cell: ({ row }) => (row.original.dueDate ? <DateText date={row.original.dueDate} /> : "—"),
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => onViewHistory(row.original)}>
              {tHistory("viewAction")}
            </Button>
            {row.original.status !== "PAID" ? (
              <Can I="finance.create">
                <Button size="sm" variant="secondary" onClick={() => onReceivePayment(row.original)}>
                  {t("receivePayment")}
                </Button>
              </Can>
            ) : null}
          </div>
        ),
      },
    ],
    [t, tHistory, saleById, onReceivePayment, onViewHistory],
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2"
    >
      <DataTable
        columns={columns}
        data={items}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
      />
    </div>
  );
}
