"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Wrench } from "lucide-react";
import { Avatar, AvatarFallback } from "@rakhal/ui/ui/avatar";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { avatarTint } from "../avatar-tint";
import { EquipmentRowActions } from "./equipment-row-actions";
import { StockStatusIcon } from "./stock-status-icon";
import type { Equipment } from "../types";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";

/**
 * Column set matched to the Figma "Inventory - Other - Table View" frame (732:23402): No. / Item
 * Name (+thumb) / Asset ID / Type / Cost Per Unit / Purchase Date / Stock / Action. Equipment has
 * no `imageUrl` field at all (see `types.ts#Equipment` doc comment) — every row uses the tinted
 * `Wrench`-icon fallback, never a real thumbnail.
 */
export function buildEquipmentColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  startIndex: number,
  rowActions: {
    onEdit: (equipment: Equipment) => void;
    onArchive: (equipment: Equipment) => void;
  },
): ColumnDef<Equipment, unknown>[] {
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
        const equipment = row.original;
        return (
          <span className="flex items-center gap-2">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className={avatarTint(equipment.id)}>
                <Wrench className="size-4" aria-hidden />
              </AvatarFallback>
            </Avatar>
            <TruncatedText className="max-w-[16rem] text-sm font-medium text-foreground">{equipment.name}</TruncatedText>
          </span>
        );
      },
    },
    {
      id: "assetId",
      header: t("columns.assetId"),
      cell: ({ row }) => row.original.assetId ?? "—",
    },
    {
      id: "type",
      header: t("columns.type"),
      cell: ({ row }) => t(`typeOptions.${row.original.type}`),
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
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {row.original.currentStock} <span className="font-normal text-muted-foreground">{row.original.unit?.symbol || t("piece")}</span>
          </span>
          <StockStatusIcon status={row.original.stockStatus} />
        </span>
      ),
    },
    {
      id: "__actions__",
      header: t("columns.action"),
      size: 72,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <EquipmentRowActions equipment={row.original} onEdit={rowActions.onEdit} onArchive={rowActions.onArchive} />
        </div>
      ),
    },
  ];
}
