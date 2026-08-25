"use client"; // live query + column defs

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { usePurchasesV2 } from "../hooks/use-finance-v2";
import type { Purchase } from "../types-v2";

/** "What was bought" summary — same capped-join shape as `ledger-sales-table.tsx#saleSummary`.
 * `PurchaseLine` has no `description` field of its own (unlike `SaleLine`) — it only carries a real
 * FK to exactly one of Medicine/FeedItem/EquipmentId (`purchase.prisma`'s own doc comment), and none
 * of those three items' names are resolvable here without an N+1 lookup this read-only ledger list
 * doesn't attempt (a real gap, flagged not faked) — shown as a plain line count instead of a
 * fabricated item name. */
export function purchaseSummary(purchase: Purchase): string {
  const n = purchase.lines.length;
  if (n === 0) return "—";
  return `${n}`;
}

/**
 * RAKHAL-360 — Ledger "Purchases" segment. `GET /purchasing/purchases` (RAKHAL-348, un-paginated —
 * same real backend gap `ledger-sales-table.tsx` documents for `GET /sales`).
 */
export function LedgerPurchasesTable() {
  const t = useTranslations("finance.ledgerV2.purchases");
  const query = usePurchasesV2();

  const columns = useMemo<ColumnDef<Purchase, unknown>[]>(
    () => [
      {
        id: "date",
        header: t("columns.date"),
        cell: ({ row }) => <DateText date={row.original.purchaseDate} />,
      },
      {
        id: "document",
        header: t("columns.document"),
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.purchaseNumber}</span>,
      },
      {
        id: "whatWasBought",
        header: t("columns.whatWasBought"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm text-foreground">{t("itemCount", { count: purchaseSummary(row.original) })}</span>
          </div>
        ),
      },
      {
        id: "supplier",
        header: t("columns.supplier"),
        cell: ({ row }) => row.original.supplierId ?? "—",
      },
      {
        id: "amount",
        header: t("columns.amount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} className="font-medium" />,
      },
    ],
    [t],
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
