"use client"; // columns need client callbacks

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { buildFeedItemColumns } from "./feed-item-columns";
import type { FeedItem } from "../types";

export function FeedItemTable({
  items,
  startIndex,
  isLoading,
  isError,
  onRetry,
  onView,
  onEdit,
  onArchive,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
}: {
  items: FeedItem[];
  startIndex: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onView: (feedItem: FeedItem) => void;
  onEdit: (feedItem: FeedItem) => void;
  onArchive: (feedItem: FeedItem) => void;
  enableRowSelection: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}) {
  const t = useTranslations("inventory.feed");
  const columns = useMemo(
    () => buildFeedItemColumns(t, startIndex, { onView, onEdit, onArchive }),
    [t, startIndex, onView, onEdit, onArchive],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border",
        // Same Figma-matched density override the cattle/medicine tables use, scoped to this instance only.
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
