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

/** Figma "Filter" component: icon + label pill that opens a panel — the panel content is this
 * bar's existing select filters plus checklist sections plus a Clear-filters action, not a new
 * filter model. */
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
  const searchParams = useSearchParams();
  const activeCount =
    selects.filter((s) => searchParams.has(s.key)).length +
    checklists.reduce((sum, c) => {
      const raw = searchParams.get(c.key);
      return sum + (raw ? raw.split(",").filter(Boolean).length : 0);
    }, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Default (md/h-11) size — matches the search input's height (`h-11`) in the same row,
            and the page-header "Add X" button next to it (also default size). */}
        <Button variant="outline" className="gap-1.5 text-muted-foreground">
          <FilterIcon className="size-4" aria-hidden />
          Filter
          {activeCount > 0 ? (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        {selects.map((select) => (
          <FilterSelect key={select.key} config={select} />
        ))}
        {checklists.map((checklist) => (
          <FilterChecklist key={checklist.key} config={checklist} />
        ))}
        <ClearFiltersButton
          searchKey={searchKey}
          selectKeys={selects.map((s) => s.key)}
          checklistKeys={checklists.map((c) => c.key)}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({ config }: { config: FilterBarSelectConfig }) {
  const [value, setValue] = useQueryState(config.key, parseAsString);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{config.label}</label>
      <Select value={value ?? undefined} onValueChange={(next) => void setValue(next)}>
        <SelectTrigger aria-label={config.label}>
          <SelectValue placeholder={config.placeholder ?? config.label} />
        </SelectTrigger>
        <SelectContent>
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
      <label className="text-xs font-medium text-muted-foreground">{config.label}</label>
      {showSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${config.label.toLowerCase()}…`}
            className="h-8 pl-8 text-sm"
            aria-label={`Search ${config.label}`}
          />
        </div>
      ) : null}
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={values.includes(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
            />
            {option.label}
          </label>
        ))}
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">No matches</p>
        ) : null}
      </div>
    </div>
  );
}

function ClearFiltersButton({
  searchKey,
  selectKeys,
  checklistKeys = [],
}: {
  searchKey?: string;
  selectKeys: string[];
  checklistKeys?: string[];
}) {
  const keys = [...(searchKey ? [searchKey] : []), ...selectKeys, ...checklistKeys];
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAny = keys.some((k) => searchParams.has(k));

  if (!hasAny) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString());
        keys.forEach((k) => params.delete(k));
        router.replace(params.size > 0 ? `?${params.toString()}` : window.location.pathname);
      }}
    >
      <X className="size-3.5" />
      Clear filters
    </Button>
  );
}
