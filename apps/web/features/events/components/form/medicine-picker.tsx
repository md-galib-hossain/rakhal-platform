"use client"; // popover + debounced server search + scroll-to-load-more

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@rakhal/ui/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useMedicineDetail, useMedicineInfiniteList } from "@/features/inventory/hooks/use-inventory";
import type { Medicine } from "@/features/inventory/types";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function StockChip({ medicine }: { medicine: Medicine }) {
  const t = useTranslations("pickers.medicine");
  if (medicine.expiryStatus === "expired") return <Chip variant="destructive" subtle>{t("expired")}</Chip>;
  if (medicine.currentStock <= 0) return <Chip variant="destructive" subtle>{t("outOfStock")}</Chip>;
  return (
    <Chip variant={medicine.stockStatus === "low" ? "warning" : "muted"} subtle>
      {t("inStock", { stock: medicine.currentStock, unit: medicine.unit.symbol })}
    </Chip>
  );
}

/**
 * Inventory medicine chooser for the Treatment / Vaccination / Deworming forms. A searchable list (server search, pages in
 * as it is scrolled — the farm's stock can run past one page) where every option shows what is left and in what unit, so
 * the dose can be sized before it is typed. The chosen medicine is handed to `onPick` whole: the form prefills and locks
 * the dose unit from it.
 */
export function MedicinePicker({
  id,
  value,
  onPick,
  describedBy,
  invalid,
}: {
  id: string;
  value: string | undefined;
  onPick: (medicine: Medicine | null) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const t = useTranslations("pickers.medicine");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 250);
  const listRef = useRef<HTMLDivElement>(null);

  const list = useMedicineInfiniteList({ search: debounced || undefined });
  const selected = useMedicineDetail(value);
  const busy = list.isLoading || debounced !== search.trim();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn("h-12 w-full justify-between gap-2 px-3 font-normal", !value && "text-muted-foreground")}
        >
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className="w-full truncate text-base sm:text-sm">{selected.data?.name ?? t("placeholder")}</span>
            {selected.data ? (
              <span className="w-full truncate text-xs text-muted-foreground">
                {t("stockLine", { stock: selected.data.currentStock, unit: selected.data.unit.symbol })}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("searchPlaceholder")} value={search} onValueChange={setSearch} />
          <CommandList ref={listRef} className="max-h-72 overscroll-contain">
            {busy && list.items.length === 0 ? (
              <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                {t("searching")}
              </div>
            ) : null}
            {!busy && list.items.length === 0 ? <CommandEmpty>{list.isError ? t("error") : t("empty")}</CommandEmpty> : null}
            <CommandGroup>
              {list.items.map((medicine) => (
                <CommandItem
                  key={medicine.id}
                  value={medicine.id}
                  onSelect={() => {
                    onPick(medicine);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Check className={cn("size-4 shrink-0", medicine.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="truncate">{medicine.name}</span>
                  </span>
                  <StockChip medicine={medicine} />
                </CommandItem>
              ))}
            </CommandGroup>
            {list.items.length > 0 ? (
              <InfiniteScrollFooter
                hasNextPage={Boolean(list.hasNextPage)}
                isFetchingNextPage={list.isFetchingNextPage}
                isError={list.isNextPageError}
                onLoadMore={list.fetchNextPage}
                loadedCount={list.items.length}
                rootRef={listRef}
                rootMargin="120px"
              />
            ) : null}
          </CommandList>
          {list.hasNextPage ? <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{t("hint")}</p> : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
