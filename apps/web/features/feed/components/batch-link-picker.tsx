"use client"; // per-line search-select over the farm's own inventory

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { effectiveFromLot } from "../lib/recipe-line";
import type { EffectiveIngredientNutrition } from "../lib/formula-math";
import { useConcentrations, useFeedStock } from "../hooks/use-feed";

export interface BatchLink {
  feedItemId?: string;
  /** RAKHAL-447: pin the line to one lot of `feedItemId`; omitted = the FIFO head at the time of use. */
  feedItemBatchId?: string;
  feedStockId?: string;
}

/**
 * RAKHAL-422/RFE-112 (2026-09-14) — per-line control that lets a recipe line (a `FeedMixtureTable`
 * row) name a specific inventory batch it actually consumes on finalize, instead of staying a
 * virtual catalogue line. Applies identically to a Concentrate Mixer and a TMR line — see
 * `docs/EPIC_PREPARED_FEED.md` §2.
 *
 * **Why this can't offer a precise match for a `FeedStock` (Concentrate-batch) link**: the backend
 * validates a link against the batch's own ingredient — for a `FeedItem` that's a direct
 * `ingredient_id` field (filtered here client-side after a normal name search, same pattern
 * `IngredientPicker` already uses), but a `FeedStock` lot carries no `ingredientId` of its own. It
 * only resolves through the `FeedIngredient` row promoted from its `source_concentration_id`
 * (`feed-concentration.service.ts`'s `assertBatchLinks()`), and that promoted ingredient's
 * `source_concentration_id` is **not exposed** by `GET /feed/ingredients` — confirmed by reading
 * `feed-ingredient.service.ts`'s `toMerged()` mapper directly, 2026-09-14. So this picker narrows
 * the Concentrate-batch list to `kind === 'CONCENTRATE_TEMPLATE'` with real stock (a genuine,
 * accurate filter) and defers the exact ingredient match to the backend's own authoritative
 * validation at save time, same as several other cross-entity constraints this app can't fully
 * pre-validate client-side. **Not a fabricated match** — narrowing by kind is correct as far as it
 * goes; it just isn't the full match. A `FeedItem` link, by contrast, is fully precise: its
 * `ingredientId` is compared directly against the line's own `ingredientId`.
 *
 * Search is wired straight into the paginated `search` param per keystroke, same as
 * `item-picker.tsx` (Purchasing) — no separate debounce utility exists anywhere in this codebase,
 * so this doesn't invent one; react-query's own cache/key dedup carries the load, matching the
 * established convention exactly.
 */
export function BatchLinkPicker({
  ingredientId,
  link,
  onChange,
}: {
  ingredientId: string;
  link: BatchLink | undefined;
  /** `lotEffective` is the linked lot's nutrition + price for the live totals preview (D7: a lot-backed
   * line is computed from the lot, not the catalogue); `undefined` when the link is cleared. */
  onChange: (link: BatchLink | undefined, lotEffective?: EffectiveIngredientNutrition) => void;
}) {
  const t = useTranslations("feed.table.batchLink");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const feedItems = useFeedItemPagedList({ search: search || undefined });
  const stock = useFeedStock();
  const concentrations = useConcentrations();

  const purchasedOptions = useMemo(
    () =>
      (feedItems.items ?? [])
        .filter((item) => item.ingredientId === ingredientId)
        .map((item) => ({
          id: item.id,
          item,
          label: `${item.name} (${item.currentStock} ${item.unit.symbol})`,
          // Only lots that still hold stock can be pinned; with one lot there is nothing to choose.
          lots: item.batches.filter((b) => b.currentStock > 0),
        })),
    [feedItems.items, ingredientId],
  );

  const concentrateNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of concentrations.data ?? []) map.set(c.id, c.name);
    return map;
  }, [concentrations.data]);

  const concentrateOptions = useMemo(
    () =>
      (stock.data ?? [])
        .filter((lot) => lot.kind === "CONCENTRATE_TEMPLATE" && lot.current_stock_kg > 0)
        .map((lot) => ({
          id: lot.id,
          label: `${concentrateNameById.get(lot.source_concentration_id) ?? lot.id} (${lot.current_stock_kg} kg)`,
        })),
    [stock.data, concentrateNameById],
  );

  const linkedLabel = useMemo(() => {
    if (!link) return null;
    if (link.feedItemId) {
      const option = purchasedOptions.find((o) => o.id === link.feedItemId);
      const pinned = link.feedItemBatchId ? option?.item.batches.find((b) => b.id === link.feedItemBatchId) : undefined;
      const base = option?.label ?? link.feedItemId;
      return pinned ? `${base} · ${pinned.batchCode ?? t("pinnedLot")}` : base;
    }
    if (link.feedStockId) return concentrateOptions.find((o) => o.id === link.feedStockId)?.label ?? link.feedStockId;
    return null;
  }, [link, purchasedOptions, concentrateOptions, t]);

  function select(next: BatchLink, lotEffective?: EffectiveIngredientNutrition) {
    onChange(next, lotEffective);
    toast.success(t("linkedToast"));
    setOpen(false);
    setSearch("");
  }

  function clear() {
    onChange(undefined);
    toast.success(t("clearedToast"));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }} modal={false}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1 text-left">
          {link && linkedLabel ? (
            <Chip variant="muted" className="max-w-[10rem] truncate px-1.5 py-0 text-[10px]">
              <Link2 className="mr-1 size-3 shrink-0" aria-hidden />
              {linkedLabel}
            </Chip>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <Link2 className="size-3" aria-hidden />
              {t("none")}
              <ChevronsUpDown className="size-3 opacity-60" aria-hidden />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b border-border p-2.5">
          <p className="text-xs font-medium text-foreground">{t("title")}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{t("hint")}</p>
        </div>
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("searchPurchased")} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{feedItems.isLoading ? "…" : t("noPurchasedFound")}</CommandEmpty>
            {purchasedOptions.length > 0 ? (
              <CommandGroup heading={t("purchasedGroup")}>
                {purchasedOptions.map((opt) => (
                  <div key={opt.id}>
                    <CommandItem
                      value={opt.id}
                      onSelect={() => select({ feedItemId: opt.id }, effectiveFromLot(opt.item) ?? undefined)}
                    >
                      <Check
                        className={cn("mr-2 size-4", link?.feedItemId === opt.id && !link.feedItemBatchId ? "opacity-100" : "opacity-0")}
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{opt.label}</span>
                        {opt.lots.length > 1 ? <span className="text-[10px] text-muted-foreground">{t("anyBatch")}</span> : null}
                      </span>
                    </CommandItem>
                    {opt.lots.length > 1
                      ? opt.lots.map((lot) => (
                          <CommandItem
                            key={lot.id}
                            value={`${opt.id}:${lot.id}`}
                            className="pl-8"
                            onSelect={() => select({ feedItemId: opt.id, feedItemBatchId: lot.id }, effectiveFromLot(opt.item, lot.id) ?? undefined)}
                          >
                            <Check className={cn("mr-2 size-4", link?.feedItemBatchId === lot.id ? "opacity-100" : "opacity-0")} aria-hidden />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-xs">
                                {t("pinLot", { code: lot.batchCode ?? t("pinnedLot"), stock: lot.currentStock, unit: opt.item.unit.symbol })}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {t("lotProfile", { cost: lot.costPerUnit, cp: lot.nutrition.cpPct, me: lot.nutrition.meMjPerKgDm })}
                              </span>
                            </span>
                          </CommandItem>
                        ))
                      : null}
                  </div>
                ))}
              </CommandGroup>
            ) : null}
            <CommandGroup heading={t("concentrateGroup")}>
              <p className="px-2 pb-1 text-[10px] leading-tight text-muted-foreground">{t("concentrateHint")}</p>
              {concentrateOptions.length === 0 ? (
                <p className="px-2 pb-2 text-xs text-muted-foreground">{t("noConcentrateBatches")}</p>
              ) : (
                concentrateOptions.map((opt) => (
                  <CommandItem key={opt.id} value={opt.id} onSelect={() => select({ feedStockId: opt.id })}>
                    <Check className={cn("mr-2 size-4", link?.feedStockId === opt.id ? "opacity-100" : "opacity-0")} aria-hidden />
                    {opt.label}
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
        {link ? (
          <div className="border-t border-border p-1">
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={clear}>
              <X className="size-3.5" aria-hidden />
              {t("clear")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
