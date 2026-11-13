"use client"; // debounced search over the farm's medicine stock

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Syringe, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { searchMedicines, type MedicineOption } from "../api";

export interface MedicinePickerProps {
  value?: MedicineOption | null;
  onValueChange: (medicine: MedicineOption | null) => void;
  disabled?: boolean;
  /** Protocol builder: no preview card under the trigger — the row shows stock + unit itself. */
  compact?: boolean;
}

/** Log Treatment tab's "Select Medicine" field (Figma 734:37459) — search-select over the real
 * `GET /inventory/medicines`, mirroring `CattlePicker`'s structure. Selecting a medicine shows a
 * small preview row (name + live stock count) below the trigger, matching the Figma mock's
 * "Penicillin G · Stock: 50 Doses" card. */
export function MedicinePicker({ value, onValueChange, disabled, compact }: MedicinePickerProps) {
  const t = useTranslations("health.caseSheet.logTreatment");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["health-medicine-picker", search],
    queryFn: () => searchMedicines(search),
    enabled: open,
    staleTime: 30_000,
  });
  const options = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
          >
            {value ? value.name : t("selectMedicinePlaceholder")}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("searchMedicine")} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{isLoading ? t("searching") : t("noMedicines")}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onValueChange(option);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 size-4", option.id === value?.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{option.name}</span>
                    <span className={cn("ml-2 shrink-0 text-xs", option.currentStock > 0 ? "text-muted-foreground" : "font-medium text-destructive")}>
                      {option.currentStock > 0 ? `${option.currentStock} ${option.unit.symbol}` : t("outOfStock")}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && !compact ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Syringe className="size-4 text-muted-foreground" aria-hidden />
            {value.name}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t("stock")}: <span className="font-medium text-foreground">{value.currentStock}</span> {value.unit.symbol}
            </span>
            <button type="button" onClick={() => onValueChange(null)} aria-label={t("clearMedicine")}>
              <Trash2 className="size-4 text-destructive" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
