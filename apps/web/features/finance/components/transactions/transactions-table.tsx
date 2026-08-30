"use client"; // infinite query + column defs

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { useTransactionsList } from "./hooks";
import type { TransactionRow, TransactionsFilters } from "./types";

const STATUS_VARIANT: Record<TransactionRow["status"], ChipProps["variant"]> = {
  POSTED: "primary",
  REVERSED: "destructive",
};

/** RAKHAL-385 — the unified Transactions table: `Date | Type | Reference | Party | Account | Amount
 * | Status`, cursor "load more". `Amount` renders `cashAmount` when it is genuinely non-zero (a real
 * cash movement), falling back to the neutral `amount` (document gross) for a cash-neutral row (a
 * credit sale) — same heuristic `overview/recent-transactions-panel.tsx` (RAKHAL-383) already
 * established, kept consistent rather than inventing a second convention. `Reference` links to
 * `source.href` when the backend provides one (drill-through wiring itself is RAKHAL-392's own
 * scope — this just doesn't waste the field the backend already sends). */
export function TransactionsTable({ filters }: { filters: TransactionsFilters }) {
  const t = useTranslations("finance.transactionsV2");
  const query = useTransactionsList(filters);
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const columns = useMemo<ColumnDef<TransactionRow, unknown>[]>(
    () => [
      {
        id: "date",
        header: t("columns.date"),
        cell: ({ row }) => <DateText date={row.original.transactionDate} />,
      },
      {
        id: "type",
        header: t("columns.type"),
        cell: ({ row }) => <span className="text-sm text-foreground">{row.original.typeLabel}</span>,
      },
      {
        id: "reference",
        header: t("columns.reference"),
        cell: ({ row }) => {
          const { reference, source } = row.original;
          const text = reference ?? t("noReference");
          return source.href ? (
            <Link href={source.href} className="text-sm font-medium text-primary hover:underline">
              {text}
            </Link>
          ) : (
            <span className="text-sm font-medium text-foreground">{text}</span>
          );
        },
      },
      {
        id: "party",
        header: t("columns.party"),
        cell: ({ row }) => <span className="text-sm text-foreground">{row.original.party?.name ?? t("noParty")}</span>,
      },
      {
        id: "account",
        header: t("columns.account"),
        cell: ({ row }) => <span className="text-sm text-foreground">{row.original.accounts.join(", ") || t("noAccount")}</span>,
      },
      {
        id: "amount",
        header: t("columns.amount"),
        cell: ({ row }) => {
          const cash = Number(row.original.cashAmount);
          const displayAmount = cash !== 0 ? cash : Number(row.original.amount);
          return <MoneyText amount={displayAmount} colorize={cash !== 0} className="font-medium" />;
        },
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => <Chip variant={STATUS_VARIANT[row.original.status]}>{t(`statusOptions.${row.original.status}`)}</Chip>,
      },
    ],
    [t],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
