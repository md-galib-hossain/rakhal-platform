"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { buildBuyerColumns } from "./buyer-columns";
import type { Buyer } from "../types";

export function BuyerTable({
  items,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onDeactivate,
  onStatement,
  onRecordDispatch,
}: {
  items: Buyer[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (buyer: Buyer) => void;
  onDeactivate: (buyer: Buyer) => void;
  onStatement: (buyer: Buyer) => void;
  onRecordDispatch: (buyer: Buyer) => void;
}) {
  const t = useTranslations("buyers.list");
  const columns = useMemo(
    () => buildBuyerColumns(t, { onEdit, onDeactivate, onStatement, onRecordDispatch }),
    [t, onEdit, onDeactivate, onStatement, onRecordDispatch],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border",
        "[&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted",
        "[&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground",
        "[&_tbody_td]:py-2",
      )}
    >
      <DataTable
        columns={columns}
        data={items}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
      />
    </div>
  );
}
