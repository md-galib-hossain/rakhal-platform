"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Wheat } from "lucide-react";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { avatarTint } from "../avatar-tint";
import { ForageRowActions } from "./forage-row-actions";
import { StockStatusIcon } from "./stock-status-icon";
import type { Forage } from "../types";

/**
 * Column set matched to the Figma "Inventory - Forage - Table View" frame (732:12950): No. / Feed
 * Name (+thumb) / Type / Category / Cost Per Unit / Purchase Date / Stock / Action. No Batch
 * ID/Expiry Date columns (Forage has neither field, unlike Medicine) — the mock's row data is
 * literally leftover Medicine placeholder text ("Rabies Vaccine", "Viral" category), not real
 * forage content, so it isn't used as a data source, only for column layout. Forage has no photo
 * field at all (see `types.ts#Forage` doc comment) so every row uses the tinted-icon fallback,
 * never a real thumbnail.
 */
export function buildForageColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  startIndex: number,
  rowActions: {
    onView: (forage: Forage) => void;
    onEdit: (forage: Forage) => void;
    onArchive: (forage: Forage) => void;
  },
): ColumnDef<Forage, unknown>[] {
  return [
    {
      id: "no",
      header: t("columns.no"),
      size: 48,
      cell: ({ row }) => <span className="text-muted-foreground">{String(startIndex + row.index + 1).padStart(2, "0")}</span>,
    },
    {
      id: "name",
      header: t("columns.name"),
      cell: ({ row }) => {
        const forage = row.original;
        return (
          <button type="button" onClick={() => rowActions.onView(forage)} className="flex items-center gap-2 text-left">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className={avatarTint(forage.id)}>
                <Wheat className="size-4" aria-hidden />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{forage.name}</span>
          </button>
        );
      },
    },
    {
      id: "type",
      header: t("columns.type"),
      cell: ({ row }) => t(`typeOptions.${row.original.type}`),
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: ({ row }) => row.original.category ?? "—",
    },
    {
      id: "costPerUnit",
      header: t("columns.costPerUnit"),
      cell: ({ row }) => <MoneyText amount={row.original.costPerUnit} />,
    },
    {
      id: "purchaseDate",
      header: t("columns.purchaseDate"),
      cell: ({ row }) => <DateText date={row.original.purchaseDate} />,
    },
    {
      id: "stock",
      header: t("columns.stock"),
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {row.original.currentStock} <span className="font-normal text-muted-foreground">{row.original.unit}</span>
            </span>
            <StockStatusIcon status={row.original.stockStatus} />
          </span>
          {row.original.kgPerUnit != null ? (
            <span className="text-xs text-muted-foreground">
              {row.original.kgPerUnit}kg/{row.original.unit}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "__actions__",
      header: t("columns.action"),
      size: 72,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ForageRowActions
            forage={row.original}
            onView={rowActions.onView}
            onEdit={rowActions.onEdit}
            onArchive={rowActions.onArchive}
          />
        </div>
      ),
    },
  ];
}
