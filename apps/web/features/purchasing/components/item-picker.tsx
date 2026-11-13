"use client"; // debounced search over Medicine/FeedItem/Equipment, kind-switchable

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, PackageSearch, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rakhal/ui/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { inventoryApi } from "@/features/inventory/api";
import type { PurchasableItemKind, PurchasableItemOption } from "../types";

const KIND_ORDER: PurchasableItemKind[] = ["MEDICINE", "FEED_ITEM", "EQUIPMENT"];

async function searchByKind(kind: PurchasableItemKind, search: string): Promise<PurchasableItemOption[]> {
  if (kind === "MEDICINE") {
    const page = await inventoryApi.listMedicines({ search: search || undefined }, undefined, 20);
    return page.items.map((m) => ({ id: m.id, name: m.name, currentStock: m.currentStock, unitSymbol: m.unit.symbol }));
  }
  if (kind === "FEED_ITEM") {
    const page = await inventoryApi.listFeedItems({ search: search || undefined }, undefined, 20);
    return page.items.map((f) => ({ id: f.id, name: f.name, currentStock: f.currentStock, unitSymbol: f.unit.symbol }));
  }
  const page = await inventoryApi.listEquipment({ search: search || undefined }, undefined, 20);
  return page.items.map((e) => ({ id: e.id, name: e.name, currentStock: e.currentStock, unitSymbol: e.unit?.symbol ?? "" }));
}

/**
 * RAKHAL-359 — combined Medicine/FeedItem/Equipment search-select for a `PurchaseLine`. No such
 * combined picker existed anywhere in `features/inventory/**` before this ticket (only a
 * medicine-only picker at `features/health/components/medicine-picker.tsx` and a feed-ingredient
 * picker unrelated to `FeedItem` stock) — checked per the ticket brief before building this rather
 * than assuming one existed. Reuses the exact Popover+Command search-select shape from
 * `MedicinePicker`/`UnitPicker` (same template both those components already document as theirs);
 * the one addition is a `Select` above the search box to switch which of the 3 inventory tables is
 * being searched, since a `PurchaseLine` is exactly one of `medicineId`/`feedItemId`/`equipmentId`
 * (`validatePurchaseLineDetailShape`, enforced server-side). Ends with **+ New item** (the caller opens
 * `NewItemSheet`; the item is created server-side with the purchase, as `newItem`).
 */
export function ItemPicker({
  kind,
  onKindChange,
  value,
  onChange,
  error,
  onCreateNew,
  isNewItem = false,
}: {
  kind: PurchasableItemKind;
  onKindChange: (kind: PurchasableItemKind) => void;
  value: PurchasableItemOption | null;
  onChange: (item: PurchasableItemOption | null) => void;
  error?: string;
  /** Shows "+ New item" at the end of the list; the caller opens its own sheet. */
  onCreateNew?: () => void;
  /** `value` is an item that does not exist yet (typed via `onCreateNew`) — its stock chip says so
   * instead of showing a stock figure. */
  isNewItem?: boolean;
}) {
  const t = useTranslations("purchasing.itemPicker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["purchasing-item-picker", kind, search],
    queryFn: () => searchByKind(kind, search),
    enabled: open,
    staleTime: 30_000,
  });
  const options = useMemo(() => data ?? [], [data]);

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={kind}
        onValueChange={(next) => {
          onKindChange(next as PurchasableItemKind);
          onChange(null);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("itemType")} />
        </SelectTrigger>
        <SelectContent>
          {KIND_ORDER.map((k) => (
            <SelectItem key={k} value={k}>
              {t(`kind.${k}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left text-sm shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring",
              !value && "text-muted-foreground",
              error && "border-destructive focus-within:ring-destructive",
            )}
          >
            {value ? value.name : t("selectItemPlaceholder")}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("searchItem")} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{isLoading ? t("searching") : t("noItemsFound")}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 size-4", option.id === value?.id ? "opacity-100" : "opacity-0")} aria-hidden />
                    {option.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {option.currentStock} {option.unitSymbol}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {onCreateNew ? (
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCreateNew();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-muted"
                >
                  <Plus className="size-4" aria-hidden />
                  {t("newItem")}
                </button>
              </div>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {value ? (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <PackageSearch className="size-3.5 shrink-0" aria-hidden />
          {isNewItem ? (
            t("newItemChip")
          ) : (
            <>
              {t("currentStockLabel")}: <span className="font-medium text-foreground">{value.currentStock}</span> {value.unitSymbol}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
