"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { buildDispatchColumns } from "./dispatch-columns";
import type { Dispatch } from "../types";

export function DispatchTable({
  items,
  isLoading,
  isError,
  onRetry,
}: {
  items: Dispatch[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("buyers.dispatchHistory");
  const columns = useMemo(() => buildDispatchColumns(t), [t]);

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
