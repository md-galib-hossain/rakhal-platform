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

export interface FilterBarProps {
  /** URL search-param key for the debounced search box, e.g. "q". Omit to hide the search input. */
  searchKey?: string;
  searchPlaceholder?: string;
  selects?: FilterBarSelectConfig[];
  /** Extra controls (date-range picker, etc.) rendered after the Filter button. */
  extra?: React.ReactNode;
  className?: string;
}

/** Debounced search (300ms) + a single "Filter" popover holding the select filters, all
 * URL-synced via nuqs. Matches the Figma "Cattle" list's search+Filter-button row (a single icon
 * button, not N always-visible selects) — the selects themselves are unchanged, just behind one
 * click instead of spread across the row. Resets DataTable's cursor by design. */
export function FilterBar({ searchKey, searchPlaceholder = "Search…", selects = [], extra, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 [&>*]:shrink-0", className)}>
      {searchKey ? <SearchInput paramKey={searchKey} placeholder={searchPlaceholder} /> : null}
      {selects.length > 0 ? <FilterPopover selects={selects} searchKey={searchKey} /> : null}
      {extra}
    </div>
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
    <div className="relative w-full max-w-xs">
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
 * bar's existing select filters plus a Clear-filters action, not a new filter model. */
function FilterPopover({ selects, searchKey }: { selects: FilterBarSelectConfig[]; searchKey?: string }) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const activeCount = selects.filter((s) => searchParams.has(s.key)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      <PopoverContent align="end" className="flex w-64 flex-col gap-3">
        {selects.map((select) => (
          <FilterSelect key={select.key} config={select} />
        ))}
        <ClearFiltersButton searchKey={searchKey} selectKeys={selects.map((s) => s.key)} />
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

function ClearFiltersButton({ searchKey, selectKeys }: { searchKey?: string; selectKeys: string[] }) {
  const keys = [...(searchKey ? [searchKey] : []), ...selectKeys];
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
