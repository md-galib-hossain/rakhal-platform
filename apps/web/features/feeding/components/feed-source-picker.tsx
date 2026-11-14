"use client"; // popover open + search state, capsule filtering over plans/concentrate/tmr/inventory + multi-select

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, ClipboardList, Layers, Package, Wheat, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rakhal/ui/ui/command";
import { Chip } from "@rakhal/ui/ui/chip";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { useFeedStock, useConcentrations } from "@/features/feed/hooks/use-feed";
import { useFeedPlansList } from "@/features/feed/hooks/use-feed-plans";
import { nextFeedLot, stockedLotCount } from "@/features/inventory/feed-lots";
import type { FeedItem } from "@/features/inventory/types";
import type { FeedPlan } from "@/features/feed/plans-types";
import { sourceKey, type RowLine, type RowSource } from "../grid-model";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";

export interface PreparedOption {
  id: string;
  label: string;
}

export type FeedSourceFilter = "all" | "plans" | "concentrate" | "tmr" | "purchased";

/** "Next: LOT-1 · ৳5/kg · CP 9% · 2 batches" — the lot FIFO draws first (RFE-123, ADR-026 D6), so the farmer sees
 * which delivery — and which nutrition — a feeding is about to use. */
export function lotHint(item: FeedItem, t: ReturnType<typeof useTranslations>): string | undefined {
  const lot = nextFeedLot(item);
  if (!lot) return undefined;
  const base = t("rowSource.nextLot", {
    code: lot.batchCode ?? t("rowSource.oldestBatch"),
    cost: lot.costPerUnit,
    unit: item.unit.symbol,
    cp: lot.nutrition.cpPct,
  });
  const count = stockedLotCount(item);
  return count > 1 ? `${base} · ${t("rowSource.moreBatches", { n: count })}` : base;
}

export interface FeedSourcePickerProps {
  /** The currently chosen source (for single-source selection, e.g. bulk toolbar). */
  value?: RowSource | null;
  /** Active lines on the cow row (for multi-select toggle mode). */
  lines?: RowLine[];
  /** Prepared batches (TMR / concentrate lots) that still have stock. */
  preparedOptions?: PreparedOption[];
  onSelect?: (source: RowSource, name?: string) => void;
  onToggleSource?: (source: RowSource, name?: string) => void;
  onSelectPlan?: (plan: FeedPlan) => void;
  onClear?: () => void;
  onOpen?: () => void;
  /** The element that opens the picker (rendered `asChild`). */
  children: ReactNode;
  align?: "start" | "center" | "end";
  /** Extra actions under the list (e.g. "Add feed item"); receives `close` so a click can dismiss the popover. */
  footer?: (close: () => void) => ReactNode;
}

/**
 * Capsule-categorized search-and-pick list over everything feedable:
 * - Feed Plans (applies plan rations)
 * - Concentrate (prepared concentrate batches & recipes)
 * - TMR (prepared TMR batches & recipes)
 * - Purchased Feed Items (individual inventory feed items in stock)
 *
 * Supports multi-select toggle when `onToggleSource` / `lines` is provided.
 */
export function FeedSourcePicker({
  value,
  lines,
  preparedOptions,
  onSelect,
  onToggleSource,
  onSelectPlan,
  onClear,
  onOpen,
  children,
  align = "start",
  footer,
}: FeedSourcePickerProps) {
  const t = useTranslations("feeding.grid");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) onOpen?.();
    else setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        sticky="always"
        className="w-[360px] p-0 shadow-lg sm:w-[440px]"
        align={align}
      >
        {open ? (
          <PickerBody
            search={search}
            onSearchChange={setSearch}
            preparedOptions={preparedOptions}
            value={value ?? null}
            lines={lines}
            onSelect={(s, name) => {
              onSelect?.(s, name);
              setOpen(false);
              setSearch("");
            }}
            onToggleSource={onToggleSource}
            onSelectPlan={
              onSelectPlan
                ? (plan) => {
                    onSelectPlan(plan);
                    setOpen(false);
                    setSearch("");
                  }
                : undefined
            }
            onClear={
              onClear
                ? () => {
                    onClear();
                    setOpen(false);
                  }
                : undefined
            }
            onClose={() => {
              setOpen(false);
              setSearch("");
            }}
            t={t}
          />
        ) : null}
        {open && footer ? (
          <div className="flex flex-col border-t border-border bg-muted/20 p-1">{footer(() => setOpen(false))}</div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Split out so data queries only run while the popover is open. */
function PickerBody({
  search,
  onSearchChange,
  preparedOptions,
  value,
  lines,
  onSelect,
  onToggleSource,
  onSelectPlan,
  onClear,
  onClose,
  t,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  preparedOptions?: PreparedOption[];
  value: RowSource | null;
  lines?: RowLine[];
  onSelect?: (s: RowSource, name?: string) => void;
  onToggleSource?: (s: RowSource, name?: string) => void;
  onSelectPlan?: (plan: FeedPlan) => void;
  onClear?: () => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [filter, setFilter] = useState<FeedSourceFilter>("all");

  const feedItemsQuery = useFeedItemPagedList({ search: search || undefined });
  const feedPlansQuery = useFeedPlansList({ search: search || undefined });
  const feedStockQuery = useFeedStock();
  const concentrationsQuery = useConcentrations();

  const isMulti = Boolean(onToggleSource);

  // Set of selected source keys
  const selectedSourceKeys = useMemo(() => {
    const set = new Set<string>();
    if (lines) {
      for (const l of lines) {
        if (l.source) set.add(sourceKey(l.source));
      }
    } else if (value) {
      set.add(sourceKey(value));
    }
    return set;
  }, [lines, value]);

  const concentrationsMap = useMemo(() => {
    return new Map((concentrationsQuery.data ?? []).map((c) => [c.id, c]));
  }, [concentrationsQuery.data]);

  // Purchased feed items (all inventory feed items matching search)
  const purchasedItems = useMemo(() => {
    const list = feedItemsQuery.items ?? [];
    if (!search.trim()) return list;
    const lower = search.toLowerCase();
    return list.filter((i) => i.name.toLowerCase().includes(lower) || i.feedClass.toLowerCase().includes(lower));
  }, [feedItemsQuery.items, search]);

  // Feed plans
  const feedPlans = useMemo(() => {
    return feedPlansQuery.items ?? [];
  }, [feedPlansQuery.items]);

  // Prepared lots categorized by Concentrate vs TMR
  const { concentrateLots, tmrLots } = useMemo(() => {
    const concLots: { id: string; name: string; stockKg: number; kind: string }[] = [];
    const tLots: { id: string; name: string; stockKg: number; kind: string }[] = [];

    const stocks = feedStockQuery.data ?? [];

    for (const s of stocks) {
      const conc = s.source_concentration_id ? concentrationsMap.get(s.source_concentration_id) : undefined;
      const name = conc?.name ?? t("unknownStock");
      if (conc?.kind === "FEED_MIXTURE") {
        tLots.push({ id: s.id, name, stockKg: s.current_stock_kg, kind: "FEED_MIXTURE" });
      } else {
        concLots.push({ id: s.id, name, stockKg: s.current_stock_kg, kind: "CONCENTRATE_TEMPLATE" });
      }
    }

    // Fallback if feedStock query is empty but preparedOptions are passed
    if (concLots.length === 0 && tLots.length === 0 && preparedOptions && preparedOptions.length > 0) {
      for (const opt of preparedOptions) {
        concLots.push({ id: opt.id, name: opt.label, stockKg: 0, kind: "CONCENTRATE_TEMPLATE" });
      }
    }

    const q = search.trim().toLowerCase();
    return {
      concentrateLots: q ? concLots.filter((c) => c.name.toLowerCase().includes(q)) : concLots,
      tmrLots: q ? tLots.filter((tItem) => tItem.name.toLowerCase().includes(q)) : tLots,
    };
  }, [feedStockQuery.data, concentrationsMap, preparedOptions, search, t]);

  const showPlans = (filter === "all" || filter === "plans") && (feedPlans.length > 0 || filter === "plans");
  const showConcentrate = (filter === "all" || filter === "concentrate") && (concentrateLots.length > 0 || filter === "concentrate");
  const showTmr = (filter === "all" || filter === "tmr") && (tmrLots.length > 0 || filter === "tmr");
  const showPurchased = (filter === "all" || filter === "purchased") && (purchasedItems.length > 0 || filter === "purchased");

  const isEmpty =
    (showPlans ? feedPlans.length : 0) +
      (showConcentrate ? concentrateLots.length : 0) +
      (showTmr ? tmrLots.length : 0) +
      (showPurchased ? purchasedItems.length : 0) ===
    0;

  function handleItemClick(source: RowSource, name?: string) {
    if (onToggleSource) {
      onToggleSource(source, name);
    } else if (onSelect) {
      onSelect(source, name);
    }
  }

  return (
    <>
      <Command shouldFilter={false}>
        <div className="border-b border-border p-2">
          <CommandInput
            placeholder={t("rowSource.searchPlaceholder")}
            value={search}
            onValueChange={onSearchChange}
            className="h-9"
          />
          {/* Capsule Filter Tabs */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t("rowSource.filterAll")}
            </button>
            <button
              type="button"
              onClick={() => setFilter("plans")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                filter === "plans"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <ClipboardList className="size-3" aria-hidden />
              <span>{t("rowSource.filterPlans")}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("concentrate")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                filter === "concentrate"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Wheat className="size-3" aria-hidden />
              <span>{t("rowSource.filterConcentrate")}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("tmr")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                filter === "tmr"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Layers className="size-3" aria-hidden />
              <span>{t("rowSource.filterTmr")}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("purchased")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                filter === "purchased"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Package className="size-3" aria-hidden />
              <span>{t("rowSource.filterPurchased")}</span>
            </button>
          </div>
        </div>

        <CommandList className="h-[280px] overflow-y-auto p-1">
          {isEmpty ? (
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              {feedItemsQuery.isLoading || feedPlansQuery.isLoading ? "…" : t("noItemsFound")}
            </CommandEmpty>
          ) : null}

          {/* 1. Feed Plans */}
          {showPlans && feedPlans.length > 0 ? (
            <CommandGroup heading={t("rowSource.plansGroup")}>
              {feedPlans.map((plan) => (
                <CommandItem
                  key={`plan-${plan.id}`}
                  value={`plan-${plan.id}`}
                  onSelect={() => onSelectPlan?.(plan)}
                  className="flex cursor-pointer items-center justify-between gap-2 py-2 px-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="size-3.5 shrink-0 text-primary" aria-hidden />
                      <TruncatedText className="text-sm font-medium text-foreground">{plan.name}</TruncatedText>
                      <Chip variant="purple" className="px-1.5 py-0 text-xs font-medium shrink-0">
                        {plan.kind === "TMR_SHORTCUT" ? "TMR" : plan.kind === "CONCENTRATE_SHORTCUT" ? "Concentrate" : "Plan"}
                      </Chip>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{t("rowSource.ingredientsCount", { count: plan.lines?.length ?? 0 })}</span>
                      <span>·</span>
                      <span className="font-semibold text-foreground">{t("rowSource.kgPerDay", { kg: plan.total_kg_per_day })}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {/* 2. Concentrate */}
          {showConcentrate && concentrateLots.length > 0 ? (
            <CommandGroup heading={t("rowSource.concentrateGroup")}>
              {concentrateLots.map((lot) => {
                const sKey = sourceKey({ sourceType: "FEED_STOCK", itemId: lot.id });
                const selected = selectedSourceKeys.has(sKey);
                return (
                  <CommandItem
                    key={`conc-${lot.id}`}
                    value={`conc-${lot.id}`}
                    onSelect={() => handleItemClick({ sourceType: "FEED_STOCK", itemId: lot.id }, lot.name)}
                    className="flex cursor-pointer items-center justify-between gap-2 py-2 px-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <Wheat className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                        <TruncatedText className="text-sm font-medium text-foreground">{lot.name}</TruncatedText>
                        <Chip variant="info" className="px-1.5 py-0 text-xs font-medium shrink-0">
                          {t("rowSource.filterConcentrate")}
                        </Chip>
                      </div>
                      {lot.stockKg > 0 ? (
                        <span className="text-xs text-success font-medium">
                          {t("rowSource.inStock", { kg: lot.stockKg })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("rowSource.outOfStock")}
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                      )}
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}

          {/* 3. TMR */}
          {showTmr && tmrLots.length > 0 ? (
            <CommandGroup heading={t("rowSource.tmrGroup")}>
              {tmrLots.map((lot) => {
                const sKey = sourceKey({ sourceType: "FEED_STOCK", itemId: lot.id });
                const selected = selectedSourceKeys.has(sKey);
                return (
                  <CommandItem
                    key={`tmr-${lot.id}`}
                    value={`tmr-${lot.id}`}
                    onSelect={() => handleItemClick({ sourceType: "FEED_STOCK", itemId: lot.id }, lot.name)}
                    className="flex cursor-pointer items-center justify-between gap-2 py-2 px-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <Layers className="size-3.5 shrink-0 text-purple-600 dark:text-purple-400" aria-hidden />
                        <TruncatedText className="text-sm font-medium text-foreground">{lot.name}</TruncatedText>
                        <Chip variant="purple" className="px-1.5 py-0 text-xs font-medium shrink-0">
                          {t("rowSource.filterTmr")}
                        </Chip>
                      </div>
                      {lot.stockKg > 0 ? (
                        <span className="text-xs text-success font-medium">
                          {t("rowSource.inStock", { kg: lot.stockKg })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("rowSource.outOfStock")}
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                      )}
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}

          {/* 4. Purchased Feed Items */}
          {showPurchased && purchasedItems.length > 0 ? (
            <CommandGroup heading={t("rowSource.purchasedGroup")}>
              {purchasedItems.map((item) => {
                const hint = lotHint(item, t);
                const sKey = sourceKey({ sourceType: "FEED_ITEM", itemId: item.id });
                const selected = selectedSourceKeys.has(sKey);
                const hasStock = item.currentStock > 0;
                return (
                  <CommandItem
                    key={`item-${item.id}`}
                    value={`item-${item.id}`}
                    onSelect={() => handleItemClick({ sourceType: "FEED_ITEM", itemId: item.id }, item.name)}
                    className="flex cursor-pointer items-center justify-between gap-2 py-2 px-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <Package className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                        <TruncatedText className="text-sm font-medium text-foreground">{item.name}</TruncatedText>
                        <Chip variant="teal" className="px-1.5 py-0 text-xs font-medium shrink-0">
                          {item.feedClass}
                        </Chip>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={hasStock ? "text-success font-medium" : "text-destructive font-medium"}>
                          {hasStock ? `${item.currentStock} ${item.unit.symbol}` : t("rowSource.outOfStock")}
                        </span>
                        {hint ? <span className="truncate text-muted-foreground/80">· {hint}</span> : null}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                      )}
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>

      {isMulti ? (
        <div className="flex items-center justify-between border-t border-border bg-muted/20 p-2">
          <div className="flex items-center gap-2">
            {selectedSourceKeys.size > 0 && onClear ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                onClick={onClear}
              >
                <X className="mr-1 size-3" aria-hidden />
                {t("rowSource.clear")}
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {selectedSourceKeys.size > 0
                ? t("rowSource.selectedCount", { count: selectedSourceKeys.size })
                : null}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="h-8 px-4 text-xs font-semibold"
            onClick={onClose}
          >
            {t("rowSource.done")}
          </Button>
        </div>
      ) : value && onClear ? (
        <div className="border-t border-border bg-muted/20 p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10"
            onClick={onClear}
          >
            <X className="size-3.5" aria-hidden />
            {t("rowSource.clear")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
