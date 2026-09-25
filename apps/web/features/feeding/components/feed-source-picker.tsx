"use client"; // popover open + search state, paged inventory search

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { nextFeedLot, stockedLotCount } from "@/features/inventory/feed-lots";
import type { FeedItem } from "@/features/inventory/types";
import type { RowSource } from "../grid-model";

export interface PreparedOption {
  id: string;
  label: string;
}

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

interface Props {
  /** The currently chosen source, shown with a check mark. */
  value?: RowSource | null;
  /** Prepared batches (TMR / concentrate lots) that still have stock. */
  preparedOptions: PreparedOption[];
  onSelect: (source: RowSource) => void;
  onClear?: () => void;
  onOpen?: () => void;
  /** The element that opens the picker (rendered `asChild`). */
  children: ReactNode;
  align?: "start" | "center" | "end";
  /** Extra actions under the list (e.g. "Add feed item"); receives `close` so a click can dismiss the popover. */
  footer?: (close: () => void) => ReactNode;
}

/**
 * One search-and-pick list over everything a cow can be fed from: bought feed items *that have stock* and prepared
 * batches. Used for the per-row "+ Add feed" and the toolbar's bulk source, so both offer the same choices.
 */
export function FeedSourcePicker({
  value,
  preparedOptions,
  onSelect,
  onClear,
  onOpen,
  children,
  align = "start",
  footer,
}: Props) {
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
      <PopoverContent className="w-72 p-0 shadow-lg sm:w-80" align={align}>
        {open ? (
          <PickerBody
            search={search}
            onSearchChange={setSearch}
            preparedOptions={preparedOptions}
            value={value ?? null}
            onSelect={(s) => {
              onSelect(s);
              setOpen(false);
              setSearch("");
            }}
            onClear={
              onClear
                ? () => {
                    onClear();
                    setOpen(false);
                  }
                : undefined
            }
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

/** Split out so the inventory search only runs while the popover is open. */
function PickerBody({
  search,
  onSearchChange,
  preparedOptions,
  value,
  onSelect,
  onClear,
  t,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  preparedOptions: PreparedOption[];
  value: RowSource | null;
  onSelect: (s: RowSource) => void;
  onClear?: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const feedItems = useFeedItemPagedList({ search: search || undefined });
  const items = useMemo(() => feedItems.items.filter((i) => i.currentStock > 0), [feedItems.items]);
  const prepared = useMemo(
    () => preparedOptions.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [preparedOptions, search],
  );

  return (
    <>
      <Command shouldFilter={false}>
        <CommandInput placeholder={t("rowSource.searchPlaceholder")} value={search} onValueChange={onSearchChange} />
        <CommandList className="max-h-64">
          <CommandEmpty>{feedItems.isLoading ? "…" : t("noItemsFound")}</CommandEmpty>
          {items.length > 0 ? (
            <CommandGroup heading={t("rowSource.purchasedGroup")}>
              {items.map((item) => {
                const hint = lotHint(item, t);
                const selected = value?.sourceType === "FEED_ITEM" && value.itemId === item.id;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect({ sourceType: "FEED_ITEM", itemId: item.id })}
                    className="flex cursor-pointer items-center gap-2 py-2"
                  >
                    <Check className={cn("size-4 shrink-0 text-primary", selected ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {item.name} ({item.currentStock} {item.unit.symbol})
                      </span>
                      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
          {prepared.length > 0 ? (
            <CommandGroup heading={t("rowSource.preparedGroup")}>
              {prepared.map((opt) => {
                const selected = value?.sourceType === "FEED_STOCK" && value.itemId === opt.id;
                return (
                  <CommandItem
                    key={opt.id}
                    value={opt.id}
                    onSelect={() => onSelect({ sourceType: "FEED_STOCK", itemId: opt.id })}
                    className="flex cursor-pointer items-center gap-2 py-2"
                  >
                    <Check className={cn("size-4 shrink-0 text-primary", selected ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
      {value && onClear ? (
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
