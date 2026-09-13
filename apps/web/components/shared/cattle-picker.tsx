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

import type { CattleGender, ReproductiveStatus } from "@/features/cattle/types";

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
   * 400s on if the wrong gender is submitted (`getFemaleCattle`), or reproductive status filtering. */
  filters?: {
    gender?: CattleGender;
    reproductiveStatus?: ReproductiveStatus;
  };
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
    queryKey: ["cattle-picker", search, filters?.gender, filters?.reproductiveStatus],
    queryFn: () =>
      apiFetchPage<CattleOption>("/cattle", {
        searchParams: {
          limit: 20,
          search: search || undefined,
          gender: filters?.gender,
          reproductiveStatus: filters?.reproductiveStatus,
        },
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

export interface CattleMultiPickerProps {
  value: CattleOption[];
  onValueChange: (next: CattleOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filters?: {
    gender?: CattleGender;
    reproductiveStatus?: ReproductiveStatus;
  };
  /** Hides these cattle from the dropdown entirely — e.g. `feed-groups-section.tsx`'s "add
   * cattle" picker excludes cows already in the group, since re-picking one there would be a
   * silent no-op against `POST .../assign-cattle`. */
  excludeIds?: string[];
}

/** Multi-select variant of `CattlePicker` — task hub "target cows" (user request, no ticket #). Stays
 * open across picks so a farmer can select several cows in one pass, and re-selecting a checked row
 * unselects it (checkbox semantics), not just the external chip-list's own remove button. */
export function CattleMultiPicker({
  value,
  onValueChange,
  placeholder = "Select cattle…",
  disabled,
  className,
  filters,
  excludeIds,
}: CattleMultiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cattle-picker", search, filters?.gender, filters?.reproductiveStatus],
    queryFn: () =>
      apiFetchPage<CattleOption>("/cattle", {
        searchParams: {
          limit: 20,
          search: search || undefined,
          gender: filters?.gender,
          reproductiveStatus: filters?.reproductiveStatus,
        },
      }),
    enabled: open,
    staleTime: 30_000,
  });

  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const options = useMemo(() => (data?.items ?? []).filter((c) => !excluded.has(c.id)), [data, excluded]);
  const selectedIds = useMemo(() => new Set(value.map((c) => c.id)), [value]);

  function toggle(option: CattleOption) {
    if (selectedIds.has(option.id)) {
      onValueChange(value.filter((c) => c.id !== option.id));
    } else {
      onValueChange([...value, option]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", value.length === 0 && "text-muted-foreground", className)}
        >
          {value.length > 0 ? `${value.length} selected` : placeholder}
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
                <CommandItem key={option.id} value={option.id} onSelect={() => toggle(option)}>
                  <Check className={cn("mr-2 size-4", selectedIds.has(option.id) ? "opacity-100" : "opacity-0")} />
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
