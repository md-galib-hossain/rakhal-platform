"use client"; // search-select over the live supplier list

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rakhal/ui/ui/command";
import { useSuppliers } from "@/features/settings/hooks/use-workspace";
import { QuickAddSupplierSheet } from "@/features/suppliers/components/quick-add-supplier-sheet";
import { useCanAddSupplier } from "@/features/suppliers/hooks";

/**
 * RAKHAL-391 (MILESTONE 22) — `Supplier` search-select for the Record Purchase modal's now-required
 * `supplierId` field (`BUSINESS_IA_PRD.md` §5.13's field table marks Supplier `required`). Reads the
 * existing `/settings/suppliers` list (RAKHAL-032, a real `Supplier` FK since RAKHAL-365 promoted
 * `Purchase.supplierId`/`Payable.supplierId` off it) — same Popover+Command search-select shape as
 * `AccountPicker`/`ItemPicker`. Ends with **+ New supplier** (name + phone, `QuickAddSupplierSheet`) for a
 * user who may add suppliers (`useCanAddSupplier`) — the new supplier is selected straight away so a
 * first-time purchase never leaves the form.
 */
export function SupplierPicker({
  value,
  onChange,
  error,
}: {
  value: string | undefined;
  onChange: (supplierId: string) => void;
  error?: string;
}) {
  const t = useTranslations("purchasing.supplierPicker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const canAdd = useCanAddSupplier();

  const { data, isLoading } = useSuppliers();
  const suppliers = useMemo(() => data?.suppliers ?? [], [data]);
  const selected = useMemo(() => suppliers.find((s) => s.id === value), [suppliers, value]);
  const filtered = useMemo(
    () => suppliers.filter((s) => s.deleted_at == null && s.name.toLowerCase().includes(search.toLowerCase())),
    [suppliers, search],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring",
              error && "border-destructive focus-within:ring-destructive",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">{t("supplier")}</span>
              <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
                {selected ? selected.name : t("selectSupplier")}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("searchSupplier")} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{isLoading ? t("loading") : t("noSuppliersFound")}</CommandEmpty>
              <CommandGroup>
                {filtered.map((supplier) => (
                  <CommandItem
                    key={supplier.id}
                    value={supplier.id}
                    onSelect={() => {
                      onChange(supplier.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 size-4", supplier.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                    <Truck className="mr-2 size-3.5 shrink-0 opacity-60" aria-hidden />
                    {supplier.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {canAdd ? (
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuickAddOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-muted"
                >
                  <Plus className="size-4" aria-hidden />
                  {t("newSupplier")}
                </button>
              </div>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>
      <QuickAddSupplierSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} onCreated={(supplier) => onChange(supplier.id)} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
