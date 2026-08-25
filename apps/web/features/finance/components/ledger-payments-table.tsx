"use client"; // live query + column defs

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { useFinancialAccounts, usePaymentsV2 } from "../hooks/use-finance-v2";
import type { FinancePayment } from "../types-v2";

/**
 * RAKHAL-360 — Ledger "Payments" segment. `GET /finance/payments` (RAKHAL-337, un-paginated, no
 * `receivableId`/`payableId` filter — same call `usePaymentHistory` (RAKHAL-358) already fans out
 * from, shared cache entry via the same `qk.finance.paymentsV2()` key).
 *
 * Account name resolved client-side against `useFinancialAccounts()` (RAKHAL-355's live account
 * list) rather than showing a raw `financialAccountId` — the one join this segment needs is a
 * farm-scoped id → name lookup, not a ledger-account name (`FINANCE_V2_DESIGN.md` §9's constraint is
 * about never showing debit/credit — a `FinancialAccount`'s own farmer-facing name is exactly what
 * the design doc says the UI *should* show).
 */
export function LedgerPaymentsTable() {
  const t = useTranslations("finance.ledgerV2.payments");
  const query = usePaymentsV2();
  const accountsQuery = useFinancialAccounts();

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accountsQuery.data ?? []) map.set(account.id, account.name);
    return map;
  }, [accountsQuery.data]);

  const columns = useMemo<ColumnDef<FinancePayment, unknown>[]>(
    () => [
      {
        id: "date",
        header: t("columns.date"),
        cell: ({ row }) => <DateText date={row.original.transactionDate} />,
      },
      {
        id: "direction",
        header: t("columns.direction"),
        cell: ({ row }) => {
          const incoming = row.original.direction === "INCOMING";
          const Icon = incoming ? ArrowDownToLine : ArrowUpFromLine;
          return (
            <Chip variant={incoming ? "primary" : "warning"}>
              <Icon className="mr-1 size-3" aria-hidden />
              {t(`directionOptions.${row.original.direction}`)}
            </Chip>
          );
        },
      },
      {
        id: "account",
        header: t("columns.account"),
        cell: ({ row }) => accountNameById.get(row.original.financialAccountId) ?? "—",
      },
      {
        id: "method",
        header: t("columns.method"),
        cell: ({ row }) => t(`methodOptions.${row.original.method}`),
      },
      {
        id: "reference",
        header: t("columns.reference"),
        cell: ({ row }) => row.original.referenceNumber ?? "—",
      },
      {
        id: "amount",
        header: t("columns.amount"),
        cell: ({ row }) => {
          const incoming = row.original.direction === "INCOMING";
          return (
            <span className="font-medium">
              {incoming ? "+" : "-"}
              <MoneyText amount={Number(row.original.amount)} colorize={false} />
            </span>
          );
        },
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
