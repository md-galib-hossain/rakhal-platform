"use client"; // syncs filters to the URL via nuqs

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Filter as FilterIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";

export interface FilterBarSelectOption {
  value: string;
  label: string;
}

export interface FilterBarSelectConfig {
  /** URL search-param key this filter reads/writes, e.g. "status". */
  key: string;
  label: string;
  placeholder?: string;
  options: FilterBarSelectOption[];
}

export interface FilterBarChecklistOption {
  value: string;
  label: string;
}

export interface FilterBarChecklistConfig {
  /** URL search-param key this filter reads/writes, holding a comma-joined value list
   * (`?feedClass=FORAGE,MINERAL`), e.g. "feedClass". */
  key: string;
  label: string;
  options: FilterBarChecklistOption[];
  /** Shows a search box above the checklist once `options.length` crosses this (default 6) —
   * the screenshot reference's "Zones" section pattern. Pass `false` to never show one. */
  searchThreshold?: number | false;
}

export interface FilterBarProps {
  /** URL search-param key for the debounced search box, e.g. "q". Omit to hide the search input. */
  searchKey?: string;
  searchPlaceholder?: string;
  selects?: FilterBarSelectConfig[];
  /** Multi-select checklist sections inside the Filter popover (checkbox list + optional
   * in-section search), each rendering its active picks as removable chips below the bar —
   * the reusable multi-value filter pattern (2026-08-15, screenshot reference). */
  checklists?: FilterBarChecklistConfig[];
  /** Extra controls (date-range picker, etc.) rendered after the Filter button. */
  extra?: React.ReactNode;
  /** "inline" (default) packs search+Filter+extra together, left-aligned — the Figma "Cattle"
   * list's row. "split" pins search to the far left and Filter+extra to the far right (Figma
   * "Inventory" list's row, `732:12448`: `Search` at x=0/w=300, `Filter`+`Buttons` grouped at
   * x=890+) — a real, different Figma spec per module, not a bug in one of them. */
  layout?: "inline" | "split";
  className?: string;
}

/** Debounced search (300ms) + a single "Filter" popover holding select + checklist filters, all
 * URL-synced via nuqs. Matches the Figma "Cattle" list's search+Filter-button row (a single icon
 * button, not N always-visible selects) — the selects themselves are unchanged, just behind one
 * click instead of spread across the row. Active checklist picks surface as removable chips below
 * the row (screenshot reference), since a multi-select's state isn't visible from a closed popover
 * the way a single select's placeholder text is. Resets DataTable's cursor by design. */
export function FilterBar({
  searchKey,
  searchPlaceholder = "Search…",
  selects = [],
  checklists = [],
  extra,
  layout = "inline",
  className,
}: FilterBarProps) {
  const search = searchKey ? <SearchInput paramKey={searchKey} placeholder={searchPlaceholder} /> : null;
  const hasFilters = selects.length > 0 || checklists.length > 0;
  const filterAndExtra = (
    <>
      {hasFilters ? (
        <FilterPopover selects={selects} checklists={checklists} searchKey={searchKey} />
      ) : null}
      {extra}
    </>
  );
  const chips = checklists.length > 0 ? <FilterChips checklists={checklists} /> : null;

  if (layout === "split") {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {search}
          <div className="flex flex-wrap items-center gap-3 [&>*]:shrink-0">{filterAndExtra}</div>
        </div>
        {chips}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3 [&>*]:shrink-0">
        {search}
        {filterAndExtra}
      </div>
      {chips}
    </div>
  );
}

/** Reads/writes a checklist filter's comma-joined URL value as a `string[]`. */
function useChecklistValues(key: string): [string[], (next: string[]) => void] {
  const [raw, setRaw] = useQueryState(key, parseAsString);
  const values = raw ? raw.split(",").filter(Boolean) : [];
  const setValues = (next: string[]) => void setRaw(next.length > 0 ? next.join(",") : null);
  return [values, setValues];
}

/** Active checklist picks rendered as removable pills below the search+Filter row — the
 * screenshot reference's "Zone 1 ✕ Zone 3 ✕" row. Only checklists have chips (selects already
 * show their one active value inside the closed Select trigger). */
function FilterChips({ checklists }: { checklists: FilterBarChecklistConfig[] }) {
  const searchParams = useSearchParams();
  const active = checklists.flatMap((config) => {
    const raw = searchParams.get(config.key);
    const values = raw ? raw.split(",").filter(Boolean) : [];
    return values.map((value) => ({
      key: config.key,
      value,
      label: config.options.find((o) => o.value === value)?.label ?? value,
    }));
  });

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((chip) => (
        <FilterChipPill key={`${chip.key}:${chip.value}`} chip={chip} />
      ))}
    </div>
  );
}

function FilterChipPill({ chip }: { chip: { key: string; value: string; label: string } }) {
  const [values, setValues] = useChecklistValues(chip.key);
  return (
    <Chip variant="primary" subtle className="gap-1 pr-1.5">
      {chip.label}
      <button
        type="button"
        onClick={() => setValues(values.filter((v) => v !== chip.value))}
        aria-label={`Remove ${chip.label}`}
        className="rounded-full p-0.5 hover:bg-primary/20"
      >
        <X className="size-3" />
      </button>
    </Chip>
  );
}

function SearchInput({ paramKey, placeholder }: { paramKey: string; placeholder: string }) {
  const [value, setValue] = useQueryState(paramKey, parseAsString.withDefault(""));
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  // Reset the draft when the URL value changes externally (e.g. the Clear button) — done during
  // render (not an effect) per https://react.dev/learn/you-might-not-need-an-effect.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) void setValue(draft || null);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    // Fixed width (Figma's "Search" component is a literal 300px, `732:12449`/`732:18131`), not
    // `w-full max-w-xs` — a percentage width on a flex item whose own container is itself
    // shrink-to-fit (as `FilterBar`'s row is when it's nested inside another flex row, e.g. the
    // Cattle/Inventory page header's title+filters row) creates a circular sizing dependency:
    // the browser can't resolve "100% of a container whose size depends on this child's size",
    // so it collapses the container's computed width well below its children's real total width,
    // pushing the last flex item (the page's Add button) onto its own wrapped line.
    <div className="relative w-[300px] shrink-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

const UNSET_SELECT = "__filter_all__";

/** Modern, spacious Filter Popover with responsive 2-col grid, header with active count & reset,
 * individual filter clear buttons, and scroll protection. */
function FilterPopover({
  selects,
  checklists,
  searchKey,
}: {
  selects: FilterBarSelectConfig[];
  checklists: FilterBarChecklistConfig[];
  searchKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeSelectKeys = selects.filter((s) => searchParams.has(s.key));
  const activeChecklistCount = checklists.reduce((sum, c) => {
    const raw = searchParams.get(c.key);
    return sum + (raw ? raw.split(",").filter(Boolean).length : 0);
  }, 0);
  const activeCount = activeSelectKeys.length + activeChecklistCount;
  const isMultiCol = selects.length >= 4;

  const allFilterKeys = [
    ...(searchKey ? [searchKey] : []),
    ...selects.map((s) => s.key),
    ...checklists.map((c) => c.key),
  ];

  function handleClearAll() {
    const params = new URLSearchParams(searchParams.toString());
    allFilterKeys.forEach((k) => params.delete(k));
    router.replace(params.size > 0 ? `?${params.toString()}` : window.location.pathname);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-1.5 transition-colors",
            activeCount > 0
              ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FilterIcon className="size-4" aria-hidden />
          Filter
          {activeCount > 0 ? (
            <span className="flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "flex flex-col p-0 shadow-2xl rounded-2xl border border-border bg-card overflow-hidden",
          isMultiCol ? "w-[340px] sm:w-[500px]" : "w-[320px] sm:w-[360px]",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="size-4 text-primary" aria-hidden />
            <h4 className="text-sm font-bold text-foreground">Filters</h4>
            {activeCount > 0 ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeCount} active
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            {activeCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearAll}
              >
                Reset all
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Filter List Body */}
        <div className="max-h-[calc(100vh-240px)] sm:max-h-[460px] overflow-y-auto p-4">
          <div className={cn("grid gap-3.5", isMultiCol ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            {selects.map((select) => (
              <FilterSelect key={select.key} config={select} />
            ))}
          </div>

          {checklists.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3.5 border-t border-dashed border-border pt-4">
              {checklists.map((checklist) => (
                <FilterChecklist key={checklist.key} config={checklist} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} filter${activeCount > 1 ? "s" : ""} applied`
              : "No filters applied"}
          </span>
          <Button size="sm" className="h-8 px-4 text-xs font-semibold" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({ config }: { config: FilterBarSelectConfig }) {
  const [value, setValue] = useQueryState(config.key, parseAsString);
  const isActive = Boolean(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground/80">{config.label}</label>
        {isActive ? (
          <button
            type="button"
            onClick={() => void setValue(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      <Select
        value={value ?? UNSET_SELECT}
        onValueChange={(next) => void setValue(next === UNSET_SELECT ? null : next)}
      >
        <SelectTrigger
          aria-label={config.label}
          className={cn(
            "h-9 text-xs rounded-lg transition-colors",
            isActive && "border-primary/50 bg-primary/5 font-medium text-foreground",
          )}
        >
          <SelectValue placeholder={config.placeholder ?? `All ${config.label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET_SELECT} className="text-muted-foreground">
            All {config.label}
          </SelectItem>
          {config.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One checklist section: label + optional in-section search (once `options.length` crosses
 * `searchThreshold`) + a checkbox per option, scrollable past 6 rows. Screenshot reference's
 * "Zones" section (search box + checkbox list), minus the collapse chevron/"View all" — every
 * option is always visible here since none of this app's filter lists run into the hundreds. */
function FilterChecklist({ config }: { config: FilterBarChecklistConfig }) {
  const [values, setValues] = useChecklistValues(config.key);
  const [query, setQuery] = useState("");
  const threshold = config.searchThreshold ?? 6;
  const showSearch = threshold !== false && config.options.length > threshold;
  const options = showSearch
    ? config.options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : config.options;

  function toggle(value: string, checked: boolean) {
    setValues(checked ? [...values, value] : values.filter((v) => v !== value));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground/80">{config.label}</label>
        {values.length > 0 ? (
          <button
            type="button"
            onClick={() => setValues([])}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear ({values.length})
          </button>
        ) : null}
      </div>
      {showSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${config.label.toLowerCase()}…`}
            className="h-8 pl-8 text-xs rounded-lg"
            aria-label={`Search ${config.label}`}
          />
        </div>
      ) : null}
      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-muted cursor-pointer"
          >
            <Checkbox
              checked={values.includes(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">No matches</p>
        ) : null}
      </div>
    </div>
  );
}
