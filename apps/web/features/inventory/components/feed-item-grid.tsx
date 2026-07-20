"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Coins, Package, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { avatarTint } from "../avatar-tint";
import { FeedItemRowActions } from "./feed-item-row-actions";
import type { FeedItem } from "../types";

const STOCK_COLOR: Record<FeedItem["stockStatus"], string> = {
  adequate: "text-success",
  low: "text-warning",
  out: "text-destructive",
};

/** Card matched to the Figma "Inventory Item Card" component (732:18604, `get_design_context`) as
 * reused on the Forage grid frame (732:13093): same anatomy as `MedicineCard` minus the batch chip
 * (no `batchId` field on a feed item) and the expiry-date row (no `expiryDate` field either) — 2
 * rows only (Cost Per Unit, Purchase Date). A feed item has no photo field at all, so the image
 * slot is always the tinted `Wheat` fallback, never a real thumbnail. */
function FeedItemCard({
  feedItem,
  onView,
  onEdit,
  onArchive,
}: {
  feedItem: FeedItem;
  onView: (feedItem: FeedItem) => void;
  onEdit: (feedItem: FeedItem) => void;
  onArchive: (feedItem: FeedItem) => void;
}) {
  const t = useTranslations("inventory.feed");
  return (
    <div className="flex w-full flex-col items-center gap-2.5 rounded-2xl bg-card p-2 shadow-card">
      <div className="relative h-[160px] w-full shrink-0 rounded-xl">
        {/* Plain `<button>`, not a `role="button"` div, so the overlapping `FeedItemRowActions`
            trigger (a sibling rendered after it, positioned on top via z-index) naturally receives
            its own clicks without needing `stopPropagation` on a nested interactive element. */}
        <button
          type="button"
          onClick={() => onView(feedItem)}
          className="absolute inset-0 cursor-pointer overflow-hidden rounded-xl text-left"
        >
          <div className={cn("flex size-full items-center justify-center", avatarTint(feedItem.id))}>
            <Wheat className="size-10" aria-hidden />
          </div>
        </button>

        <div className="absolute right-2 top-2 z-10">
          <FeedItemRowActions
            feedItem={feedItem}
            onView={onView}
            onEdit={onEdit}
            onArchive={onArchive}
            triggerClassName="size-7 rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card"
          />
        </div>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <Chip variant="muted">{t(`classOptions.${feedItem.feedClass}`)}</Chip>
          {feedItem.category ? <Chip variant="muted">{feedItem.category}</Chip> : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-6 px-1.5 pb-1.5">
        <p className="truncate text-xl font-bold text-foreground">{feedItem.name}</p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Coins className="size-4" aria-hidden />
              {t("columns.costPerUnit")}
            </span>
            <MoneyText amount={feedItem.costPerUnit} className="text-sm font-medium text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {t("columns.purchaseDate")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              <DateText date={feedItem.purchaseDate} />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-2 shadow-card">
          <span className="flex items-center gap-1 text-base font-medium text-muted-foreground">
            <Package className="size-[18px]" aria-hidden />
            {t("columns.stock")}
          </span>
          <span className="flex items-baseline gap-1">
            <span className={cn("text-[28px] font-bold leading-none", STOCK_COLOR[feedItem.stockStatus])}>{feedItem.currentStock}</span>
            <span className="text-sm font-medium text-muted-foreground">{feedItem.unit}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Card grid view (Figma "Inventory - Forage" grid frame 732:13093) — same data/actions as
 * `FeedItemTable`, toggled via `InventoryTabs`' view switch, not a separate query. */
export function FeedItemGrid({
  items,
  isLoading,
  isError,
  onRetry,
  onView,
  onEdit,
  onArchive,
}: {
  items: FeedItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onView: (feedItem: FeedItem) => void;
  onEdit: (feedItem: FeedItem) => void;
  onArchive: (feedItem: FeedItem) => void;
}) {
  const t = useTranslations("inventory.feed");

  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!isLoading && items.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading && items.length === 0
        ? Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[400px] animate-pulse rounded-2xl bg-muted" />
          ))
        : items.map((feedItem) => (
            <FeedItemCard key={feedItem.id} feedItem={feedItem} onView={onView} onEdit={onEdit} onArchive={onArchive} />
          ))}
    </div>
  );
}
