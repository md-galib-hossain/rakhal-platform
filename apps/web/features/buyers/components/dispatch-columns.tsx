"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Chip } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import type { Dispatch } from "../types";

export function buildDispatchColumns(
  t: (key: string, values?: Record<string, string | number>) => string,
): ColumnDef<Dispatch, unknown>[] {
  return [
    {
      id: "date",
      header: t("columns.date"),
      cell: ({ row }) => <DateText date={row.original.dispatchedAt} />,
    },
    {
      id: "buyer",
      header: t("columns.buyer"),
      cell: ({ row }) => row.original.buyer?.name ?? "—",
    },
    {
      id: "volumeDispatched",
      header: t("columns.volumeDispatched"),
      cell: ({ row }) => `${row.original.volumeDispatchedL} L`,
    },
    {
      id: "volumeReceived",
      header: t("columns.volumeReceived"),
      cell: ({ row }) => (row.original.volumeReceivedL != null ? `${row.original.volumeReceivedL} L` : "—"),
    },
    {
      id: "discrepancy",
      header: t("columns.discrepancy"),
      cell: ({ row }) =>
        row.original.discrepancyFlagged ? (
          <Chip variant="destructive">{`${row.original.discrepancyL} L`}</Chip>
        ) : (
          "—"
        ),
    },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: ({ row }) => <MoneyText amount={row.original.calculatedAmount} />,
    },
    {
      id: "paymentDueDate",
      header: t("columns.paymentDueDate"),
      cell: ({ row }) => (row.original.paymentDueDate ? <DateText date={row.original.paymentDueDate} /> : "—"),
    },
  ];
}
