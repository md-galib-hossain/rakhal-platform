"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import type { FinanceCategory, FinanceTxnStatus, LedgerTransaction } from "../types";

const CATEGORY_VARIANT: Record<FinanceCategory, ChipProps["variant"]> = {
  REVENUE: "primary",
  INVENTORY: "indigo",
  HEALTHCARE: "destructive",
  OVERHEAD: "muted",
  DEBT: "warning",
};

const STATUS_VARIANT: Record<FinanceTxnStatus, ChipProps["variant"]> = {
  COMPLETED: "primary",
  PENDING: "warning",
  VOIDED: "destructive",
};

/**
 * Column set matched to the Figma "Master Ledger" tab's "Transaction Ledger" table (node
 * `1039:25098`): Date / Description / Entity / Category / Method / Amount / Status. Real gap vs
 * the mock, flagged not fabricated: `FinanceTransaction` has no separate `type` filter surface in
 * the table itself — the Category chip already carries that signal (`FinanceCategory`, not the
 * mock's invented category list).
 */
export function buildLedgerColumns(
  t: (key: string, values?: Record<string, string | number>) => string,
): ColumnDef<LedgerTransaction, unknown>[] {
  return [
    {
      id: "date",
      header: t("columns.date"),
      cell: ({ row }) => <DateText date={row.original.date} />,
    },
    {
      id: "description",
      header: t("columns.description"),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{row.original.description ?? t("noDescription")}</span>
          <span className="text-xs text-muted-foreground">{row.original.reference}</span>
        </div>
      ),
    },
    {
      id: "entity",
      header: t("columns.entity"),
      cell: ({ row }) => row.original.entityName ?? "—",
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: ({ row }) => <Chip variant={CATEGORY_VARIANT[row.original.category]}>{t(`categoryOptions.${row.original.category}`)}</Chip>,
    },
    {
      id: "method",
      header: t("columns.method"),
      cell: ({ row }) => t(`methodOptions.${row.original.paymentMethod}`),
    },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: ({ row }) => {
        const txn = row.original;
        const displayAmount = txn.type === "REVENUE" ? txn.amount : -txn.amount;
        return (
          <span className="font-medium">
            {displayAmount >= 0 ? "+" : ""}
            <MoneyText amount={displayAmount} colorize />
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: ({ row }) => <Chip variant={STATUS_VARIANT[row.original.status]}>{t(`statusOptions.${row.original.status}`)}</Chip>,
    },
  ];
}
