"use client"; // debounced, paged search over the farm's cattle list

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetchPage } from "@/lib/api/client";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { cattleApi } from "@/features/cattle/api";
import { Button } from "@rakhal/ui/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";

import type { CattleGender, ReproductiveStatus } from "@/features/cattle/types";

export interface CattleOption {
  id: string;
  tagNumber: string;
  name?: string | null;
}

interface CattlePickerFilters {
  /** Narrows the `/cattle` list query — e.g. Reproduction's dam/bull pickers, which the backend
   * 400s on if the wrong gender is submitted (`getFemaleCattle`), or reproductive status filtering. */
  gender?: CattleGender;
  reproductiveStatus?: ReproductiveStatus;
}

export interface CattlePickerProps {
  value?: string;
  onValueChange: (cattleId: string, cattle: CattleOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filters?: CattlePickerFilters;
}

const PAGE_SIZE = 30;

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Server-searched, cursor-paged cattle list shared by both pickers. The farm can hold thousands of animals, so only the
 * first page loads; the rest append as the list is scrolled (`InfiniteScrollFooter`) and typing searches the whole farm. */
function useCattlePickerList(open: boolean, search: string, filters: CattlePickerFilters | undefined) {
  const debounced = useDebouncedValue(search.trim(), 250);
  const list = useInfiniteCursorList<CattleOption>(
    ["cattle-picker", debounced, filters?.gender ?? "", filters?.reproductiveStatus ?? ""],
    (cursor, limit) =>
      apiFetchPage<CattleOption>("/cattle", {
        searchParams: {
          limit,
          cursor,
          search: debounced || undefined,
          gender: filters?.gender,
          reproductiveStatus: filters?.reproductiveStatus,
        },
      }),
    { enabled: open, pageSize: PAGE_SIZE, staleTime: 30_000 },
  );
  // While the debounce window is open the list on screen is still for the previous term.
  const settling = open && debounced !== search.trim();
  return { ...list, settling };
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

  const list = useCattlePickerList(open, search, filters);
  const options = list.items;
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
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="min-w-0 truncate">
            {selected ? `${selected.tagNumber}${selected.name ? ` — ${selected.name}` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <PickerList
          search={search}
          onSearchChange={setSearch}
          options={options}
          list={list}
          isSelected={(id) => id === value}
          onPick={(option) => {
            onValueChange(option.id, option);
            setOpen(false);
            setSearch("");
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function PickerList({
  search,
  onSearchChange,
  options,
  list,
  isSelected,
  onPick,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  options: CattleOption[];
  list: ReturnType<typeof useCattlePickerList>;
  isSelected: (id: string) => boolean;
  onPick: (option: CattleOption) => void;
}) {
  const t = useTranslations("pickers.cattle");
  const listRef = useRef<HTMLDivElement>(null);
  const busy = list.isLoading || list.settling;
  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder={t("searchPlaceholder")} value={search} onValueChange={onSearchChange} />
      <CommandList ref={listRef} className="max-h-72 overscroll-contain">
        {busy && options.length === 0 ? (
          <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {t("searching")}
          </div>
        ) : null}
        {!busy && options.length === 0 ? <CommandEmpty>{list.isError ? t("error") : t("empty")}</CommandEmpty> : null}
        <CommandGroup>
          {options.map((option) => (
            <CommandItem key={option.id} value={option.id} onSelect={() => onPick(option)}>
              <Check className={cn("mr-2 size-4 shrink-0", isSelected(option.id) ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 truncate">
                {option.tagNumber}
                {option.name ? ` — ${option.name}` : ""}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        {options.length > 0 ? (
          <InfiniteScrollFooter
            hasNextPage={Boolean(list.hasNextPage)}
            isFetchingNextPage={list.isFetchingNextPage}
            isError={list.isNextPageError}
            onLoadMore={list.fetchNextPage}
            loadedCount={options.length}
            rootRef={listRef}
            rootMargin="120px"
          />
        ) : null}
      </CommandList>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{t("hint")}</p>
    </Command>
  );
}

export interface CattleMultiPickerProps {
  value: CattleOption[];
  onValueChange: (next: CattleOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filters?: CattlePickerFilters;
  /** Hides these cattle from the dropdown entirely — e.g. a picker that excludes cows already
   * chosen elsewhere in the same form, since re-picking one would be a silent no-op. */
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

  const list = useCattlePickerList(open, search, filters);
  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const options = useMemo(() => list.items.filter((c) => !excluded.has(c.id)), [list.items, excluded]);
  const selectedIds = useMemo(() => new Set(value.map((c) => c.id)), [value]);

  function toggle(option: CattleOption) {
    if (selectedIds.has(option.id)) {
      onValueChange(value.filter((c) => c.id !== option.id));
    } else {
      onValueChange([...value, option]);
    }
  }

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
        <PickerList
          search={search}
          onSearchChange={setSearch}
          options={options}
          list={list}
          isSelected={(id) => selectedIds.has(id)}
          onPick={toggle}
        />
      </PopoverContent>
    </Popover>
  );
}
