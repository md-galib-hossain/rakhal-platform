"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import type { ReceivableStatus, Settlement } from "../types";

const STATUS_VARIANT: Record<ReceivableStatus, ChipProps["variant"]> = {
  COMPLETED: "primary",
  PARTIAL: "warning",
  PENDING: "warning",
  OVERDUE: "destructive",
};

/** Shared by Receivables and Payables — same Figma table shape (`1039:33501`/`1039:33720`): Date /
 * Buyer-Entity (+ reference subtitle) / Total / Paid / Outstanding / Due Date / Status. */
export function buildSettlementsColumns(
  t: (key: string, values?: Record<string, string | number>) => string,
): ColumnDef<Settlement, unknown>[] {
  return [
    {
      id: "date",
      header: t("columns.date"),
      cell: ({ row }) => <DateText date={row.original.createdAt} />,
    },
    {
      id: "entity",
      header: t("columns.entity"),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{row.original.entityName ?? t("noEntity")}</span>
          <span className="text-xs text-muted-foreground">{row.original.reference}</span>
        </div>
      ),
    },
    {
      id: "total",
      header: t("columns.total"),
      cell: ({ row }) => <MoneyText amount={row.original.total} />,
    },
    {
      id: "paid",
      header: t("columns.paid"),
      cell: ({ row }) => <MoneyText amount={row.original.paid} />,
    },
    {
      id: "outstanding",
      header: t("columns.outstanding"),
      cell: ({ row }) => <MoneyText amount={row.original.outstanding} />,
    },
    {
      id: "dueDate",
      header: t("columns.dueDate"),
      cell: ({ row }) => (row.original.dueDate ? <DateText date={row.original.dueDate} /> : "—"),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: ({ row }) => <Chip variant={STATUS_VARIANT[row.original.status]}>{t(`statusOptions.${row.original.status}`)}</Chip>,
    },
  ];
}
