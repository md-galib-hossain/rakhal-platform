"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Coins, Package, Scale, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@rakhal/ui/ui/chip";
import { Can } from "@/lib/auth/permissions";
import { Progress } from "@rakhal/ui/ui/progress";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { SelectableCardOverlay } from "@/components/shared/selectable-card-overlay";
import { avatarTint } from "../avatar-tint";
import type { FeedStock } from "@/features/feed/types";
import type { FeedStockSource } from "./feed-stock-columns";
import { costPerKg, consumedKg, remainingPct, remainingStatus, REMAINING_STOCK_COLOR } from "./feed-stock-metrics";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";

/** Card matched to the same "Inventory Item Card" anatomy `FeedItemCard` (Purchased) uses, so the
 * Prepared segment's grid view reads as the same module: tinted icon slot (a produced batch has no
 * photo, same as a purchased feed item), a Stock tile as the headline stat, two cost rows below. A
 * remaining-vs-produced `Progress` bar is the one addition specific to a batch (a purchased item
 * has no "started at X, now at Y" arc — a produced lot always does). */
function FeedStockCard({ lot, source, tFeed, t, onDelete }: {
  lot: FeedStock;
  source: FeedStockSource | undefined;
  tFeed: (key: string) => string;
  t: (key: string) => string;
  onDelete: (lot: FeedStock) => void;
}) {
  const status = remainingStatus(lot.current_stock_kg, lot.produced_qty_kg);
  const pct = remainingPct(lot.current_stock_kg, lot.produced_qty_kg);
  const perKg = costPerKg(lot.produced_cost_tk, lot.produced_qty_kg);

  return (
    <div className="flex w-full flex-col items-center gap-2.5 rounded-2xl bg-card p-2 shadow-card">
      <div className="relative h-[160px] w-full shrink-0 rounded-xl">
        <div className={cn("flex size-full items-center justify-center rounded-xl", avatarTint(lot.id))}>
          <Package className="size-10" aria-hidden />
        </div>
        {source ? (
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <Chip variant="muted">
              {source.kind === "FEED_MIXTURE" ? tFeed("feedMixture") : tFeed("concentrationTemplate")}
            </Chip>
          </div>
        ) : null}
        <Can I="feed.delete">
          <button
            type="button"
            onClick={() => onDelete(lot)}
            aria-label={t("delete")}
            className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm transition-colors hover:bg-card hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </Can>
      </div>

      <div className="flex w-full flex-col gap-4 px-1.5 pb-1.5">
        <TruncatedText className="text-xl font-bold text-foreground">{source?.name ?? t("unknownSource")}</TruncatedText>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {t("columns.producedDate")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              <DateText date={lot.produced_at} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Coins className="size-4" aria-hidden />
              {t("columns.costPerKg")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {perKg != null ? <MoneyText amount={perKg} /> : "—"}
              <span className="text-xs">/kg</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Scale className="size-4" aria-hidden />
              {t("columns.totalCost")}
            </span>
            <MoneyText amount={lot.produced_cost_tk} className="text-sm font-medium text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-card p-2 shadow-card">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-base font-medium text-muted-foreground">
              <Package className="size-[18px]" aria-hidden />
              {t("columns.remainingQty")}
            </span>
            <span className="flex items-baseline gap-1">
              <span className={cn("text-[28px] font-bold leading-none", REMAINING_STOCK_COLOR[status])}>{lot.current_stock_kg}</span>
              <span className="text-sm font-medium text-muted-foreground">kg</span>
            </span>
          </div>
          <Progress value={pct} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("columns.producedQty")}: {lot.produced_qty_kg} kg
            </span>
            <span>
              {t("columns.consumedQty")}: {consumedKg(lot.current_stock_kg, lot.produced_qty_kg)} kg
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card grid view for the Feed tab's "Prepared" segment — same view-toggle contract as
 * `FeedItemGrid` (Purchased), so the two segments share one grid/table switch instead of the
 * Prepared segment being stuck with a single fixed layout. */
export function FeedStockGrid({
  items,
  isLoading,
  isError,
  onRetry,
  sourceById,
  onDelete,
  canSelect,
  isSelected,
  onToggleSelect,
}: {
  items: FeedStock[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  sourceById: Map<string, FeedStockSource>;
  onDelete: (lot: FeedStock) => void;
  canSelect: boolean;
  isSelected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
}) {
  const t = useTranslations("feed.stock");
  const tFeed = useTranslations("feed");

  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!isLoading && items.length === 0) {
    return <EmptyState icon={Package} title={t("empty")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading && items.length === 0
        ? Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[400px] animate-pulse rounded-2xl bg-muted" />
          ))
        : items.map((lot) => (
            <SelectableCardOverlay
              key={lot.id}
              canSelect={canSelect}
              selected={isSelected(lot.id)}
              onToggleSelect={() => onToggleSelect(lot.id)}
              label={t("bulk.selectCard", { name: sourceById.get(lot.source_concentration_id)?.name ?? t("unknownSource") })}
            >
              <FeedStockCard
                lot={lot}
                source={sourceById.get(lot.source_concentration_id)}
                tFeed={tFeed}
                t={t}
                onDelete={onDelete}
              />
            </SelectableCardOverlay>
          ))}
    </div>
  );
}
