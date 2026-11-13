"use client"; // search-select over the farm's own inventory

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Package, Plus } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rakhal/ui/ui/command";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { nextFeedLot } from "@/features/inventory/feed-lots";
import type { FeedItem } from "@/features/inventory/types";

/**
 * "Add from inventory" for the recipe builder (RFE-124, ADR-026 D7): adds a line that names only a
 * purchased feed — no catalogue ingredient needed, because its nutrition and price come from that feed's
 * batch (the pinned one, else the oldest batch with stock). Searches the paginated inventory list per
 * keystroke, the same convention as `BatchLinkPicker`.
 */
export function ProductLinePicker({
  onSelect,
  excludedItemIds,
}: {
  onSelect: (item: FeedItem) => void;
  /** Products already on the recipe as a product line — hidden so the same one isn't added twice. */
  excludedItemIds: string[];
}) {
  const t = useTranslations("feed.create.productLine");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const feedItems = useFeedItemPagedList({ search: search || undefined });
  const options = (feedItems.items ?? []).filter((item) => !excludedItemIds.includes(item.id));

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }} modal={false}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg">
          <Plus className="size-3.5" aria-hidden />
          {t("add")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border p-2.5">
          <p className="text-xs font-medium text-foreground">{t("title")}</p>
          <p className="mt-1 text-xs leading-tight text-muted-foreground">{t("hint")}</p>
        </div>
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("search")} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{feedItems.isLoading ? "…" : t("none")}</CommandEmpty>
            <CommandGroup>
              {options.map((item) => {
                const lot = nextFeedLot(item);
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onSelect(item);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Package className="mr-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {item.name} ({item.currentStock} {item.unit.symbol})
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {lot
                          ? t("nextLot", { code: lot.batchCode ?? t("oldestBatch"), cost: lot.costPerUnit, cp: lot.nutrition.cpPct })
                          : t("noStock")}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
