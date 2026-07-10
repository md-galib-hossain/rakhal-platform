"use client"; // syncs filters to the URL via nuqs

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  /** Extra controls (date-range picker, etc.) rendered after the selects. */
  extra?: React.ReactNode;
  className?: string;
}

/** Debounced search (300ms) + select filters, all URL-synced via nuqs. Resets DataTable's cursor by design. */
export function FilterBar({ searchKey, searchPlaceholder = "Search…", selects = [], extra, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {searchKey ? <SearchInput paramKey={searchKey} placeholder={searchPlaceholder} /> : null}
      {selects.map((select) => (
        <FilterSelect key={select.key} config={select} />
      ))}
      {extra}
      <ClearFiltersButton searchKey={searchKey} selectKeys={selects.map((s) => s.key)} />
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

function FilterSelect({ config }: { config: FilterBarSelectConfig }) {
  const [value, setValue] = useQueryState(config.key, parseAsString);

  return (
    <Select value={value ?? undefined} onValueChange={(next) => void setValue(next)}>
      <SelectTrigger className="w-44" aria-label={config.label}>
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
  );
}

function ClearFiltersButton({ searchKey, selectKeys }: { searchKey?: string; selectKeys: string[] }) {
  const keys = [...(searchKey ? [searchKey] : []), ...selectKeys];
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAny = keys.some((k) => searchParams.has(k));

  if (keys.length === 0 || !hasAny) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString());
        keys.forEach((k) => params.delete(k));
        router.replace(params.size > 0 ? `?${params.toString()}` : window.location.pathname);
      }}
    >
      <X className="size-3.5" />
      Clear
    </Button>
  );
}
