"use client"; // columns need client callbacks

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { buildMedicineColumns } from "./medicine-columns";
import type { Medicine } from "../types";

export function MedicineTable({
  items,
  startIndex,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onArchive,
}: {
  items: Medicine[];
  startIndex: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (medicine: Medicine) => void;
  onArchive: (medicine: Medicine) => void;
}) {
  const t = useTranslations("inventory.medicine");
  const columns = useMemo(() => buildMedicineColumns(t, startIndex, { onEdit, onArchive }), [t, startIndex, onEdit, onArchive]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border",
        // Same Figma-matched density override the cattle table uses, scoped to this instance only.
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
