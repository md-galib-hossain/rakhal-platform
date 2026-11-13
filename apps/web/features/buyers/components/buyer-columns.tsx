"use client"; // column defs consumed by the client-only DataTable

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@/components/ui/button";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import type { BuyerListRow } from "../types";

/** RAKHAL-389 (MILESTONE 22) — the AC's exact column set: `Buyer Name | Phone | Outstanding |
 * Total Purchased | Last Purchase | Actions` (`BUSINESS_IA_PRD.md` §5.10), off `GET /buyers` v2's
 * server-computed aggregates (`totalPurchased`/`lastPurchaseAt`/`outstanding`/`status`,
 * RAKHAL-372) — never re-derived client-side. `status` (real `deletedAt`-derived, not the old
 * nonexistent `isActive`) replaces the removed dedicated Status column as a small inline badge
 * next to the name, since the AC's column list has no separate Status column here (unlike the
 * Suppliers table, which does). */
export function buildBuyerColumns(
  t: (key: string, values?: Record<string, string | number>) => string,
  actions: {
    onEdit: (buyer: BuyerListRow) => void;
    onDeactivate: (buyer: BuyerListRow) => void;
    onStatement: (buyer: BuyerListRow) => void;
    onSellMilk: (buyer: BuyerListRow) => void;
  },
): ColumnDef<BuyerListRow, unknown>[] {
  return [
    {
      id: "name",
      header: t("columns.name"),
      cell: ({ row }) => (
        <Link href={`/buyers/${row.original.id}`} className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            {row.original.name}
            {row.original.status === "INACTIVE" ? <Badge variant="outline">{t("statusInactive")}</Badge> : null}
          </span>
          {row.original.contactPerson ? <span className="text-xs text-muted-foreground">{row.original.contactPerson}</span> : null}
        </Link>
      ),
    },
    {
      id: "phone",
      header: t("columns.phone"),
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      id: "outstanding",
      header: t("columns.outstanding"),
      cell: ({ row }) => <MoneyText amount={Number(row.original.outstanding)} colorize={Number(row.original.outstanding) > 0} />,
    },
    {
      id: "totalPurchased",
      header: t("columns.totalPurchased"),
      cell: ({ row }) => <MoneyText amount={Number(row.original.totalPurchased)} className="font-medium" />,
    },
    {
      id: "lastPurchase",
      header: t("columns.lastPurchase"),
      cell: ({ row }) => (row.original.lastPurchaseAt ? <DateText date={row.original.lastPurchaseAt} /> : "—"),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          {row.original.status === "ACTIVE" ? (
            <Can I="finance.create">
              <Button size="sm" variant="secondary" onClick={() => actions.onSellMilk(row.original)}>
                {t("actionsColumn.sellMilk")}
              </Button>
            </Can>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => actions.onStatement(row.original)}>
            {t("actionsColumn.statement")}
          </Button>
          <Can I="finance.update">
            <Button size="sm" variant="ghost" onClick={() => actions.onEdit(row.original)}>
              {t("actionsColumn.edit")}
            </Button>
          </Can>
          {row.original.status === "ACTIVE" ? (
            <Can I="finance.delete">
              <Button size="sm" variant="ghost" onClick={() => actions.onDeactivate(row.original)}>
                {t("actionsColumn.deactivate")}
              </Button>
            </Can>
          ) : null}
        </div>
      ),
    },
  ];
}
