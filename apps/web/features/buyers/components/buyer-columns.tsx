"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/shared/money-text";
import type { Buyer, BuyerType } from "../types";

const TYPE_VARIANT: Record<BuyerType, ChipProps["variant"]> = {
  DAIRY_COMPANY: "primary",
  COOPERATIVE: "indigo",
  LOCAL_TRADER: "warning",
  DIRECT_CONSUMER: "muted",
};

export function buildBuyerColumns(
  t: (key: string, values?: Record<string, string | number>) => string,
  actions: {
    onEdit: (buyer: Buyer) => void;
    onDeactivate: (buyer: Buyer) => void;
    onStatement: (buyer: Buyer) => void;
    onRecordDispatch: (buyer: Buyer) => void;
  },
): ColumnDef<Buyer, unknown>[] {
  return [
    {
      id: "name",
      header: t("columns.name"),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{row.original.name}</span>
          {row.original.contactPerson ? (
            <span className="text-xs text-muted-foreground">{row.original.contactPerson}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "type",
      header: t("columns.type"),
      cell: ({ row }) => <Chip variant={TYPE_VARIANT[row.original.buyerType]}>{t(`typeOptions.${row.original.buyerType}`)}</Chip>,
    },
    {
      id: "phone",
      header: t("columns.phone"),
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      id: "basePrice",
      header: t("columns.basePrice"),
      cell: ({ row }) => <MoneyText amount={row.original.basePricePerLitre} />,
    },
    {
      id: "paymentTerms",
      header: t("columns.paymentTerms"),
      cell: ({ row }) => t("paymentTermsDays", { days: row.original.paymentTermsDays }),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: ({ row }) => (
        <Chip variant={row.original.isActive ? "primary" : "muted"}>
          {row.original.isActive ? t("statusActive") : t("statusInactive")}
        </Chip>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => actions.onRecordDispatch(row.original)}>
            {t("actionsColumn.dispatch")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.onStatement(row.original)}>
            {t("actionsColumn.statement")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onEdit(row.original)}>
            {t("actionsColumn.edit")}
          </Button>
          {row.original.isActive ? (
            <Button size="sm" variant="ghost" onClick={() => actions.onDeactivate(row.original)}>
              {t("actionsColumn.deactivate")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
}
