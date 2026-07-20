"use client"; // columns need client callbacks

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { buildEquipmentColumns } from "./equipment-columns";
import type { Equipment } from "../types";

export function EquipmentTable({
  items,
  startIndex,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onArchive,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
}: {
  items: Equipment[];
  startIndex: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (equipment: Equipment) => void;
  onArchive: (equipment: Equipment) => void;
  enableRowSelection: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}) {
  const t = useTranslations("inventory.equipment");
  const columns = useMemo(() => buildEquipmentColumns(t, startIndex, { onEdit, onArchive }), [t, startIndex, onEdit, onArchive]);

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
        enableRowSelection={enableRowSelection}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
      />
    </div>
  );
}
