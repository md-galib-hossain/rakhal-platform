"use client"; // popover + live query over the farm's active pregnancies

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { reproductionApi } from "../api";

export interface PregnantCowOption {
  cattleId: string;
  pregnancyId: string;
  tagNumber: string;
  name: string | null;
}

export interface PregnantCowPickerProps {
  value?: string;
  onValueChange: (cattleId: string, pregnancyId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Cow picker scoped to "eligible for calving" (an ACTIVE pregnancy on file) — mirrors
 * `components/shared/cattle-picker.tsx`'s Popover+Command structure, but backed by
 * `GET /reproduction/pregnancies?status=ACTIVE` instead of `/cattle`, so selection carries the
 * `pregnancyId` needed to actually close the pregnancy out on calving (see `calving-event-dialog.tsx`). */
export function PregnantCowPicker({ value, onValueChange, placeholder = "Select a pregnant cow…", disabled, className }: PregnantCowPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pregnant-cow-picker"],
    queryFn: () => reproductionApi.pregnancies(undefined, undefined, 100, "ACTIVE"),
    enabled: open,
    staleTime: 30_000,
  });

  const options = useMemo<PregnantCowOption[]>(
    () =>
      (data?.items ?? [])
        .filter((p) => p.cattle)
        .map((p) => ({ cattleId: p.cattleId, pregnancyId: p.id, tagNumber: p.cattle!.tagNumber, name: p.cattle!.name })),
    [data],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.tagNumber.toLowerCase().includes(q) || o.name?.toLowerCase().includes(q));
  }, [options, search]);

  const selected = options.find((o) => o.cattleId === value);

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
            <CommandEmpty>{isLoading ? "Searching…" : "No pregnant cows found"}</CommandEmpty>
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem
                  key={option.cattleId}
                  value={option.cattleId}
                  onSelect={() => {
                    onValueChange(option.cattleId, option.pregnancyId);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", option.cattleId === value ? "opacity-100" : "opacity-0")} />
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
