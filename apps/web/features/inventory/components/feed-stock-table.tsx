"use client"; // columns need client callbacks

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { buildFeedStockColumns, type FeedStockSource } from "./feed-stock-columns";
import type { FeedStock } from "@/features/feed/types";

/** Same shared `DataTable` + density overrides as `FeedItemTable` (Purchased) — the Prepared
 * segment reads as the same module, not a bolted-on custom layout. */
export function FeedStockTable({
  items,
  isLoading,
  isError,
  onRetry,
  sourceById,
  onDelete,
}: {
  items: FeedStock[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  sourceById: Map<string, FeedStockSource>;
  onDelete: (lot: FeedStock) => void;
}) {
  const t = useTranslations("feed.stock");
  const tFeed = useTranslations("feed");
  const columns = useMemo(
    () => buildFeedStockColumns(t, tFeed, 0, sourceById, onDelete),
    [t, tFeed, sourceById, onDelete],
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
        emptyState={{ title: t("empty") }}
      />
    </div>
  );
}
