"use client"; // live query + column defs

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Beef, Droplets, Package, Sprout } from "lucide-react";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { useSalesV2 } from "../hooks/use-finance-v2";
import type { Sale, SaleLineType } from "../types-v2";

const LINE_TYPE_ICON: Record<SaleLineType, typeof Droplets> = {
  MILK: Droplets,
  ANIMAL: Beef,
  INVENTORY: Package,
  MANURE: Sprout,
};

const STATUS_VARIANT: Record<Sale["status"], ChipProps["variant"]> = {
  DRAFT: "muted",
  CONFIRMED: "primary",
  CANCELLED: "destructive",
  REFUNDED: "warning",
  PARTIALLY_REFUNDED: "warning",
};

/** Builds the "what was sold" summary for one `Sale` from its `lines[]` — the honest plain-business-
 * fact description `FINANCE_V2_DESIGN.md` §9 requires (never a ledger-account name). A single-line
 * sale shows that line's own `description` (author-supplied at Record Sale time, RAKHAL-357); a
 * multi-line sale shows a joined summary capped at 2 lines + a "+N more" tail so the cell never grows
 * unbounded. */
export function saleSummary(sale: Sale): { icon: typeof Droplets; text: string } {
  if (sale.lines.length === 0) return { icon: Package, text: "—" };
  const icon = LINE_TYPE_ICON[sale.lines[0].type];
  if (sale.lines.length === 1) return { icon, text: sale.lines[0].description };
  const shown = sale.lines.slice(0, 2).map((l) => l.description);
  const rest = sale.lines.length - shown.length;
  return { icon, text: rest > 0 ? `${shown.join(", ")} +${rest}` : shown.join(", ") };
}

/**
 * RAKHAL-360 — Ledger "Sales" segment. `GET /sales` (RAKHAL-339, un-paginated — see
 * `use-finance-v2.ts#useSalesV2`'s own doc comment on why there's no cursor "load more" here yet, a
 * real backend gap for a farm with a long sale history, not silently worked around).
 */
export function LedgerSalesTable() {
  const t = useTranslations("finance.ledgerV2.sales");
  const query = useSalesV2();

  const columns = useMemo<ColumnDef<Sale, unknown>[]>(
    () => [
      {
        id: "date",
        header: t("columns.date"),
        cell: ({ row }) => <DateText date={row.original.saleDate} />,
      },
      {
        id: "document",
        header: t("columns.document"),
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.saleNumber}</span>,
      },
      {
        id: "whatWasSold",
        header: t("columns.whatWasSold"),
        cell: ({ row }) => {
          const { icon: Icon, text } = saleSummary(row.original);
          return (
            <div className="flex items-center gap-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm text-foreground">{text}</span>
            </div>
          );
        },
      },
      {
        id: "customer",
        header: t("columns.customer"),
        cell: ({ row }) => row.original.customerId ?? "—",
      },
      {
        id: "amount",
        header: t("columns.amount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} className="font-medium" />,
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
