"use client"; // column defs + row action callbacks

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Can } from "@/lib/auth/permissions";
import type { SupplierRow } from "../types";

/** RAKHAL-390 — the AC's exact column set: `Supplier Name | Phone | Total Purchases | Payable |
 * Last Purchase | Actions`. All 4 aggregate columns come off `GET /purchasing/suppliers`
 * (RAKHAL-373) — never re-derived client-side. */
export function SupplierTable({
  rows,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onDelete,
  onAdd,
}: {
  rows: SupplierRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (row: SupplierRow) => void;
  onDelete: (row: SupplierRow) => void;
  onAdd: () => void;
}) {
  const t = useTranslations("suppliers.table");

  const columns = useMemo<ColumnDef<SupplierRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{row.original.name}</span>
            {row.original.status === "INACTIVE" ? <Badge variant="outline">{t("inactive")}</Badge> : null}
          </div>
        ),
      },
      {
        id: "phone",
        header: t("columns.phone"),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.phone ?? "—"}</span>,
      },
      {
        id: "totalPurchases",
        header: t("columns.totalPurchases"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalPurchases)} />,
      },
      {
        id: "payable",
        header: t("columns.payable"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.payable)} colorize={Number(row.original.payable) > 0} />,
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
          <Can I="settings.update">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("rowActions")} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <MoreVertical className="size-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(row.original)}>
                  <Pencil className="mr-2 size-3.5" aria-hidden />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(row.original)}>
                  {t("deactivate")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Can>
        ),
      },
    ],
    [t, onEdit, onDelete],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyState={{
          title: t("empty.title"),
          description: t("empty.description"),
          action: (
            <Can I="settings.update">
              <Button size="sm" className="gap-1.5" onClick={onAdd}>
                <Plus className="size-4" aria-hidden />
                {t("addSupplier")}
              </Button>
            </Can>
          ),
        }}
      />
    </div>
  );
}
