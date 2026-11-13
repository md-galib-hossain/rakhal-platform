"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@rakhal/ui/ui/avatar";
import { Wheat } from "lucide-react";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { avatarTint } from "../avatar-tint";
import { feedCategoryLabel } from "../feed-category";
import { FeedItemRowActions } from "./feed-item-row-actions";
import { StockStatusIcon } from "./stock-status-icon";
import type { FeedItem } from "../types";
import { TruncatedText } from "@/components/shared/truncated-text";

/**
 * Column set matched to the Figma "Inventory - Forage - Table View" frame (732:12950): No. / Feed
 * Name (+thumb) / Class / Category / Cost Per Unit / Purchase Date / Stock / Action. No Batch
 * ID/Expiry Date columns (a feed item has neither field, unlike Medicine) — the mock's row data is
 * literally leftover Medicine placeholder text ("Rabies Vaccine", "Viral" category), not real feed
 * content, so it isn't used as a data source, only for column layout. A feed item has no photo
 * field at all (see `types.ts#FeedItem` doc comment) so every row uses the tinted-icon fallback,
 * never a real thumbnail. The "Type" column (old `ForageType`) is now "Class" (`FeedClass`) — feed
 * is the umbrella, class is the scientific grouping (forage/concentrate/mineral/vitamin/additive).
 */
export function buildFeedItemColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  startIndex: number,
  rowActions: {
    onView: (feedItem: FeedItem) => void;
    onEdit: (feedItem: FeedItem) => void;
    onArchive: (feedItem: FeedItem) => void;
  },
): ColumnDef<FeedItem, unknown>[] {
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
        const feedItem = row.original;
        return (
          <button type="button" onClick={() => rowActions.onView(feedItem)} className="flex items-center gap-2 text-left">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className={avatarTint(feedItem.id)}>
                <Wheat className="size-4" aria-hidden />
              </AvatarFallback>
            </Avatar>
            <TruncatedText className="max-w-[16rem] text-sm font-medium text-foreground">{feedItem.name}</TruncatedText>
          </button>
        );
      },
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span>{feedCategoryLabel(t, row.original)}</span>
          <span className="text-xs text-muted-foreground">{t(`classOptions.${row.original.feedClass}`)}</span>
        </span>
      ),
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
              {row.original.currentStock} <span className="font-normal text-muted-foreground">{row.original.unit.symbol}</span>
            </span>
            <StockStatusIcon status={row.original.stockStatus} />
          </span>
          {row.original.kgEquivalent != null ? (
            // Server-computed via `resolveKgPerUnit()` — for a WEIGHT-dimension item this is
            // always right (derived from the unit's own `conversionToBase`), never a possibly
            // stale farmer-entered `kgPerUnit` copy.
            <span className="text-xs text-muted-foreground">{t("columns.kgEquivalent", { kg: row.original.kgEquivalent })}</span>
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
          <FeedItemRowActions
            feedItem={row.original}
            onView={rowActions.onView}
            onEdit={rowActions.onEdit}
            onArchive={rowActions.onArchive}
          />
        </div>
      ),
    },
  ];
}
