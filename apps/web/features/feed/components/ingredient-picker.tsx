"use client"; // search-select over the cached ingredient catalogue

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useFeedIngredients } from "../hooks/use-feed";

export interface IngredientOption {
  id: string;
  nameEn: string;
}

/** "Add New Item" (Figma `1065:36651`) — same search-select shape as `CattlePicker`, over the merged
 * ingredient catalogue (`GET /feed/ingredients`, Admin catalogue × this farm's overrides) instead of
 * cattle. Excludes ingredients already on the formula (`excludeIds`) so the same line can't be added
 * twice. */
export function IngredientPicker({
  onSelect,
  excludeIds,
  placeholder,
  className,
}: {
  onSelect: (option: IngredientOption) => void;
  excludeIds: string[];
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("feed");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useFeedIngredients();

  const options = useMemo(() => {
    const excluded = new Set(excludeIds);
    return (data ?? [])
      .filter((ing) => !excluded.has(ing.id))
      .filter((ing) => ing.name_en.toLowerCase().includes(search.toLowerCase()))
      .map((ing) => ({ id: ing.id, nameEn: ing.name_en }));
  }, [data, excludeIds, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="primary" size="sm" className={cn("gap-2 rounded-lg", className)}>
          {placeholder ?? t("addNewItem")}
          <ChevronsUpDown className="size-3.5 opacity-80" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("searchIngredient")} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isLoading ? t("loading") : t("noIngredientsFound")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onSelect(option);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 size-4 opacity-0" aria-hidden />
                  {option.nameEn}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
