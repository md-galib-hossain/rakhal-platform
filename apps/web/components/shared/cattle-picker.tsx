"use client"; // debounced search over the farm's cattle list

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetchPage } from "@/lib/api/client";
import { cattleApi } from "@/features/cattle/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface CattleOption {
  id: string;
  tagNumber: string;
  name?: string | null;
}

export interface CattlePickerProps {
  value?: string;
  onValueChange: (cattleId: string, cattle: CattleOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Narrows the `/cattle` list query — e.g. Reproduction's dam/bull pickers, which the backend
   * 400s on if the wrong gender is submitted (`getFemaleCattle`). */
  filters?: { gender?: "MALE" | "FEMALE" | "CASTRATED_MALE" };
}

/** Search-select of the farm's animals — used by milk log, health case, repro events, tasks. */
export function CattlePicker({
  value,
  onValueChange,
  placeholder = "Select cattle…",
  disabled,
  className,
  filters,
}: CattlePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cattle-picker", search, filters?.gender],
    queryFn: () =>
      apiFetchPage<CattleOption>("/cattle", {
        searchParams: { limit: 20, search: search || undefined, gender: filters?.gender },
      }),
    enabled: open,
    staleTime: 30_000,
  });

  const options = useMemo(() => data?.items ?? [], [data]);
  const foundInOptions = options.find((option) => option.id === value);

  // Falls back to a direct fetch when `value` is prefilled (edit dialogs) but the popover
  // list hasn't been opened yet, or the cow isn't on the fetched page.
  const { data: selectedCattle } = useQuery({
    queryKey: ["cattle-picker-selected", value],
    queryFn: () => cattleApi.findOne(value as string),
    enabled: Boolean(value) && !foundInOptions,
    staleTime: 30_000,
  });

  const selected: CattleOption | undefined =
    foundInOptions ??
    (selectedCattle ? { id: selectedCattle.id, tagNumber: selectedCattle.tagNumber, name: selectedCattle.name } : undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          {selected ? `${selected.tagNumber}${selected.name ? ` — ${selected.name}` : ""}` : placeholder}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search tag or name…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isLoading ? "Searching…" : "No cattle found"}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onValueChange(option.id, option);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", option.id === value ? "opacity-100" : "opacity-0")} />
                  {option.tagNumber}
                  {option.name ? ` — ${option.name}` : ""}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
