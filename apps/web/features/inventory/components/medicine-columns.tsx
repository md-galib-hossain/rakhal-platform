"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { avatarTint } from "../avatar-tint";
import { MedicineRowActions } from "./medicine-row-actions";
import { StockStatusIcon } from "./stock-status-icon";
import type { Medicine } from "../types";
import { TruncatedText } from "@/components/shared/truncated-text";

/**
 * Column set matched to the Figma "Inventory - Medicine - Table View" frame (732:12409): No. /
 * Medicine Name (+thumb+batch subtitle) / Batch ID / Type / Category / Cost Per Unit / Purchase
 * Date / Expiry Date / Stock / Action. **Real gap vs the mock, not silently fabricated**: Figma's
 * mock "Category" values (Viral/Bacterial) don't exist in the real backend's `MedicineCategory`
 * enum (Antibiotic/Antiparasitic/Vaccine/Vitamin/Mineral/Hormone/Anti-inflammatory/Analgesic/
 * Other, `inventory.enums.prisma`) — the real enum values render instead.
 */
export function buildMedicineColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  startIndex: number,
  rowActions: {
    onEdit: (medicine: Medicine) => void;
    onArchive: (medicine: Medicine) => void;
  },
): ColumnDef<Medicine, unknown>[] {
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
        const medicine = row.original;
        return (
          <span className="flex items-center gap-2">
            <Avatar className="size-8 rounded-lg">
              {medicine.imageUrl ? <AvatarImage src={medicine.imageUrl} alt="" /> : null}
              <AvatarFallback className={avatarTint(medicine.id)}>{medicine.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <TruncatedText className="max-w-[16rem] text-sm font-medium text-foreground">{medicine.name}</TruncatedText>
          </span>
        );
      },
    },
    {
      id: "batchId",
      header: t("columns.batchId"),
      cell: ({ row }) => row.original.batchId ?? "—",
    },
    {
      id: "type",
      header: t("columns.type"),
      cell: ({ row }) => t(`typeOptions.${row.original.type}`),
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: ({ row }) => t(`categoryOptions.${row.original.category}`),
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
      id: "expiryDate",
      header: t("columns.expiryDate"),
      cell: ({ row }) => <DateText date={row.original.expiryDate} />,
    },
    {
      id: "stock",
      header: t("columns.stock"),
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {row.original.currentStock} <span className="font-normal text-muted-foreground">{row.original.unit.symbol}</span>
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
          <MedicineRowActions medicine={row.original} onEdit={rowActions.onEdit} onArchive={rowActions.onArchive} />
        </div>
      ),
    },
  ];
}
