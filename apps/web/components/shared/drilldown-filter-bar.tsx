"use client";

import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DrilldownFilterPopover,
  DrilldownFilterChips,
  type FilterCategoryConfig,
} from "./drilldown-filter-popover";

export interface FilterScopeOption {
  id: string;
  label: string;
  count?: number;
}

export interface DrilldownFilterBarProps {
  /** Optional view scopes (e.g. "Under treatment (4)", "Treatment History", "Milk/meat withheld (0)") */
  scopes?: FilterScopeOption[];
  activeScope?: string;
  onScopeChange?: (scopeId: string) => void;
  scopeAriaLabel?: string;

  /** Search configuration */
  search?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  hideSearch?: boolean;

  /** Hierarchical filter configuration */
  categories: FilterCategoryConfig[];
  filterValues: Record<string, string[]>;
  onFilterChange: (next: Record<string, string[]>) => void;
  onClearAllFilters?: () => void;
  filterTriggerLabel?: string;
  filterPopoverTitle?: string;
  filterAlign?: "start" | "end" | "center";

  /** Right-aligned or secondary actions */
  actions?: React.ReactNode;
  extraControls?: React.ReactNode;

  /** Layout customization */
  className?: string;
}

/**
 * Reusable, high-polish Filter Bar with:
 * 1. Integrated Scope Switcher (e.g. "Under treatment (4)", "Treatment History", "Milk/meat withheld (0)")
 * 2. Debounced Search Input with clear button
 * 3. Hierarchical Drill-down Filter Popover
 * 4. Removable Filter Chips with "Clear all"
 * 5. Action Buttons slot
 */
export function DrilldownFilterBar({
  scopes,
  activeScope,
  onScopeChange,
  scopeAriaLabel = "View selection",
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  hideSearch = false,
  categories,
  filterValues,
  onFilterChange,
  onClearAllFilters,
  filterTriggerLabel = "Filter",
  filterPopoverTitle = "Add Filters",
  filterAlign = "start",
  actions,
  extraControls,
  className,
}: DrilldownFilterBarProps) {
  // Local draft search state for 300ms debounce
  const [prevSearch, setPrevSearch] = useState(search ?? "");
  const [draftSearch, setDraftSearch] = useState(search ?? "");

  if ((search ?? "") !== prevSearch) {
    setPrevSearch(search ?? "");
    setDraftSearch(search ?? "");
  }

  useEffect(() => {
    if (!onSearchChange) return;
    const timer = setTimeout(() => {
      if (draftSearch !== (search ?? "")) {
        onSearchChange(draftSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draftSearch, search, onSearchChange]);

  const handleClearAll = () => {
    if (onClearAllFilters) {
      onClearAllFilters();
    } else {
      onFilterChange({});
    }
  };

  return (
    <div className={cn("flex flex-col gap-2.5 w-full", className)}>
      {/* Primary Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left group: Scopes + Search + Filter Popover */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
          {/* Integrated Scope Switcher */}
          {scopes && scopes.length > 0 && (
            <div
              role="tablist"
              aria-label={scopeAriaLabel}
              className="inline-flex items-center rounded-xl border border-border/80 bg-muted/50 p-1 shrink-0"
            >
              {scopes.map((scope) => {
                const isActive = activeScope === scope.id;
                return (
                  <button
                    key={scope.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onScopeChange?.(scope.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                      isActive
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/40 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span>{scope.label}</span>
                    {scope.count !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "bg-muted-foreground/15 text-muted-foreground",
                        )}
                      >
                        {scope.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Input */}
          {!hideSearch && (
            <div className="relative w-full max-w-[280px] sm:max-w-[320px] shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 rounded-xl bg-card pl-9.5 pr-9 text-sm border-border/80 shadow-none focus-visible:ring-1 focus-visible:ring-primary/80"
                aria-label={searchPlaceholder}
              />
              {draftSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraftSearch("");
                    onSearchChange?.("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          )}

          {/* Hierarchical Drilldown Popover */}
          {categories.length > 0 && (
            <DrilldownFilterPopover
              categories={categories}
              value={filterValues}
              onChange={onFilterChange}
              triggerLabel={filterTriggerLabel}
              title={filterPopoverTitle}
              align={filterAlign}
            />
          )}

          {extraControls}
        </div>

        {/* Right group: Actions (Report Sickness, Record Treatment, Refresh, etc.) */}
        {actions && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Conditionally Rendered Active Filter Chips */}
      <DrilldownFilterChips
        categories={categories}
        value={filterValues}
        onChange={onFilterChange}
        onClearAll={handleClearAll}
      />
    </div>
  );
}
