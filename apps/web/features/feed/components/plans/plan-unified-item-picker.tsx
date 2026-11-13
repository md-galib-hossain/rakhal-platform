"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Package, Plus, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Chip } from "@/components/ui/chip";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { useConcentrations } from "../../hooks/use-feed";
import { itemStockKg, kgPerUnit } from "../../lib/recipe-line";
import type { FeedItem } from "@/features/inventory/types";
import type { FeedConcentrationSummary } from "../../types";

export interface PlanLineLike {
  lineType: "FEED_ITEM" | "PREPARED";
  feedItemId?: string;
  concentrationId?: string;
  name: string;
  kgPerDay: number;
}

export interface PlanUnifiedItemPickerProps {
  lines: PlanLineLike[];
  onAddFeedItem: (item: FeedItem) => void;
  onAddRecipe: (concentration: FeedConcentrationSummary) => void;
  onRemoveFeedItem: (feedItemId: string) => void;
  onRemoveRecipe: (concentrationId: string) => void;
  className?: string;
}

type SourceFilter = "all" | "inventory" | "recipes";

export function PlanUnifiedItemPicker({
  lines,
  onAddFeedItem,
  onAddRecipe,
  onRemoveFeedItem,
  onRemoveRecipe,
  className,
}: PlanUnifiedItemPickerProps) {
  const t = useTranslations("feed");
  const tPlans = useTranslations("feed.plans.editor");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const feedItemsPaged = useFeedItemPagedList({ search: search || undefined });
  const concentrationsQuery = useConcentrations();

  const selectedFeedItemIds = useMemo(
    () => new Set(lines.filter((l) => l.lineType === "FEED_ITEM" && l.feedItemId).map((l) => l.feedItemId as string)),
    [lines],
  );

  const selectedRecipeIds = useMemo(
    () =>
      new Set(
        lines.filter((l) => l.lineType === "PREPARED" && l.concentrationId).map((l) => l.concentrationId as string),
      ),
    [lines],
  );

  const filteredInventoryItems = useMemo(() => {
    const list = feedItemsPaged.items ?? [];
    if (!search.trim()) return list;
    const lower = search.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(lower));
  }, [feedItemsPaged.items, search]);

  const filteredRecipes = useMemo(() => {
    const list = concentrationsQuery.data ?? [];
    if (!search.trim()) return list;
    const lower = search.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(lower));
  }, [concentrationsQuery.data, search]);

  function toggleFeedItem(item: FeedItem) {
    if (selectedFeedItemIds.has(item.id)) {
      onRemoveFeedItem(item.id);
    } else {
      onAddFeedItem(item);
    }
  }

  function toggleRecipe(concentration: FeedConcentrationSummary) {
    if (selectedRecipeIds.has(concentration.id)) {
      onRemoveRecipe(concentration.id);
    } else {
      onAddRecipe(concentration);
    }
  }

  const showInventory = sourceFilter === "all" || sourceFilter === "inventory";
  const showRecipes = sourceFilter === "all" || sourceFilter === "recipes";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5 rounded-xl border-dashed font-medium", className)}
        >
          <Plus className="size-4" aria-hidden />
          <span>{t("addNewItem")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 sm:w-[440px]" align="end">
        <Command shouldFilter={false}>
          <div className="border-b border-border p-2">
            <CommandInput
              placeholder={t("searchIngredient")}
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  sourceFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t("allSources")}
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("inventory")}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  sourceFilter === "inventory"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Package className="size-3" aria-hidden />
                <span>{t("sourceInventory")}</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("recipes")}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  sourceFilter === "recipes"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Wheat className="size-3" aria-hidden />
                <span>{tPlans("typeRecipe")}</span>
              </button>
            </div>
          </div>

          <CommandList className="max-h-[320px] overflow-y-auto p-1">
            {showInventory && filteredInventoryItems.length === 0 && showRecipes && filteredRecipes.length === 0 ? (
              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                {t("noIngredientsFound")}
              </CommandEmpty>
            ) : null}

            {showInventory && filteredInventoryItems.length > 0 ? (
              <CommandGroup heading={t("sourceInventory")}>
                {filteredInventoryItems.map((item) => {
                  const isSelected = selectedFeedItemIds.has(item.id);
                  const stockKg = Math.round(itemStockKg(item) * 100) / 100;
                  const hasStock = stockKg > 0;

                  return (
                    <CommandItem
                      key={`inv-${item.id}`}
                      value={item.id}
                      onSelect={() => toggleFeedItem(item)}
                      className="flex items-center justify-between gap-2 px-2 py-2 cursor-pointer"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                          <Chip variant="teal" className="px-1.5 py-0 text-xs font-medium gap-1 shrink-0">
                            <Package className="size-2.5" />
                            {item.feedClass}
                          </Chip>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={cn(hasStock ? "text-success font-medium" : "text-destructive font-medium")}>
                            {hasStock ? t("inStockBadge", { stock: stockKg }) : t("outOfStockBadge")}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                        )}
                      >
                        {isSelected ? <Check className="size-3.5" /> : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {showRecipes && filteredRecipes.length > 0 ? (
              <CommandGroup heading={tPlans("typeRecipe")}>
                {filteredRecipes.map((c) => {
                  const isSelected = selectedRecipeIds.has(c.id);
                  const isTmr = c.kind === "FEED_MIXTURE";

                  return (
                    <CommandItem
                      key={`rec-${c.id}`}
                      value={c.id}
                      onSelect={() => toggleRecipe(c)}
                      className="flex items-center justify-between gap-2 px-2 py-2 cursor-pointer"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                          <Chip
                            variant={isTmr ? "purple" : "info"}
                            className="px-1.5 py-0 text-xs font-medium shrink-0"
                          >
                            {isTmr ? t("feedMixture") : t("concentrationTemplate")}
                          </Chip>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{c.is_finalized ? t("addedBadge") : tPlans("notMadeYet")}</span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                        )}
                      >
                        {isSelected ? <Check className="size-3.5" /> : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
