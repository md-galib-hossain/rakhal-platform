"use client"; // live query + column defs

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { useFinancialAccounts, useTransfers } from "../hooks/use-finance-v2";
import type { Transfer } from "../types-v2";

/**
 * RAKHAL-360 — Ledger "Transfers" segment. `GET /finance/transfers` (RAKHAL-338/356, un-paginated).
 * `useTransfers` is RAKHAL-356's own hook, reused as-is — this ticket does not duplicate the fetch,
 * only reads it for a second surface (the Ledger view) alongside 356's Accounts screen.
 */
export function LedgerTransfersTable() {
  const t = useTranslations("finance.ledgerV2.transfers");
  const query = useTransfers();
  const accountsQuery = useFinancialAccounts();

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accountsQuery.data ?? []) map.set(account.id, account.name);
    return map;
  }, [accountsQuery.data]);

  const columns = useMemo<ColumnDef<Transfer, unknown>[]>(
    () => [
      {
        id: "date",
        header: t("columns.date"),
        cell: ({ row }) => <DateText date={row.original.transactionDate} />,
      },
      {
        id: "route",
        header: t("columns.route"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-foreground">{accountNameById.get(row.original.fromFinancialAccountId) ?? "—"}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-foreground">{accountNameById.get(row.original.toFinancialAccountId) ?? "—"}</span>
          </div>
        ),
      },
      {
        id: "amount",
        header: t("columns.amount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.amount)} className="font-medium" />,
      },
      {
        id: "fee",
        header: t("columns.fee"),
        cell: ({ row }) => (Number(row.original.feeAmount) > 0 ? <MoneyText amount={Number(row.original.feeAmount)} /> : "—"),
      },
    ],
    [t, accountNameById],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
      <DataTable
        columns={columns}
        data={query.data ?? []}
        getRowId={(row) => row.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
      />
    </div>
  );
}
