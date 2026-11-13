"use client"; // search-select over the live buyer list + inline "add new buyer" sheet

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useBuyersPagedList } from "../hooks/use-buyers";
import { QuickAddBuyerSheet } from "./quick-add-buyer-sheet";
import type { Buyer } from "../types";

/**
 * `BuyerPicker` — same Popover+Command search-select shape as `features/finance/components/
 * account-picker.tsx#AccountPicker`, rebuilt over the milk-buyer catalogue. Every place a farmer
 * had to select a buyer (Record Dispatch, Record Sale's Milk step) used to be a plain `<Select>`
 * fed by an already-fetched buyer list — no way to add a buyer without leaving the flow. Here
 * "+ Add new buyer" opens the exact same right-side `BuyerFormDialog` the Buyers page uses; the
 * newly created buyer is auto-selected via `onCreated`, no second round trip.
 *
 * Only active (non-archived) buyers are offered — a deactivated buyer can't price a new dispatch.
 */
export function BuyerPicker({
  value,
  onChange,
  placeholder,
  className,
  error,
}: {
  /** Currently selected buyer id, or `undefined`/`""` for none. */
  value: string | undefined;
  onChange: (buyerId: string, buyer: Buyer) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}) {
  const t = useTranslations("buyers.picker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const buyersList = useBuyersPagedList({});

  const selected = useMemo(() => buyersList.items.find((b) => b.id === value), [buyersList.items, value]);
  const filtered = useMemo(
    () => buyersList.items.filter((b) => b.name.toLowerCase().includes(search.toLowerCase())),
    [buyersList.items, search],
  );

  function selectBuyer(buyer: Buyer) {
    onChange(buyer.id, buyer);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
        // Non-modal, matching `AccountPicker`/`UnitPicker` — never installs its own scroll lock
        // when reused inside a `Sheet`/wizard form drawer.
        modal={false}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring",
              error && "border-destructive focus-within:ring-destructive",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">{t("buyer")}</span>
              <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
                {selected ? selected.name : (placeholder ?? t("selectBuyer"))}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("searchBuyer")} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{buyersList.isLoading ? t("loading") : t("noBuyersFound")}</CommandEmpty>
              <CommandGroup>
                {filtered.map((buyer) => (
                  <CommandItem key={buyer.id} value={buyer.id} onSelect={() => selectBuyer(buyer)}>
                    <Check className={cn("mr-2 size-4", buyer.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                    {buyer.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setFormOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
              >
                <Plus className="size-4" aria-hidden />
                {t("addBuyer")}
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}

      <QuickAddBuyerSheet open={formOpen} onOpenChange={setFormOpen} onCreated={(buyer) => selectBuyer(buyer)} />
    </div>
  );
}
