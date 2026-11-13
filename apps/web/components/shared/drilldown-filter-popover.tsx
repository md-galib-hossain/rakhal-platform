"use client";

import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft, Search, Check, Filter, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Chip } from "@rakhal/ui/ui/chip";
import { cn } from "@/lib/utils";

export type FilterSelectionMode = "single" | "multi";

export interface FilterOption {
  value: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
  indicatorColor?: string; // Tailwind bg class (e.g. "bg-destructive", "bg-warning")
}

export interface FilterCategoryConfig {
  id: string;
  label: string;
  mode: FilterSelectionMode;
  searchable?: boolean;
  searchPlaceholder?: string;
  options: FilterOption[];
}

export interface DrilldownFilterPopoverProps {
  categories: FilterCategoryConfig[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  align?: "start" | "end" | "center";
  triggerLabel?: string;
  title?: string;
  clearAllLabel?: string;
  clearLabel?: string;
  searchPlaceholder?: string;
  noMatchingOptionsText?: string;
  className?: string;
}

export function DrilldownFilterPopover({
  categories,
  value,
  onChange,
  align = "end",
  triggerLabel = "Filter",
  title = "Add Filters",
  clearAllLabel = "Clear All",
  clearLabel = "Clear",
  searchPlaceholder = "Search here…",
  noMatchingOptionsText = "No matching options",
  className,
}: DrilldownFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [searchQuery, setSearchQuery] = useState("");
  const shouldReduceMotion = useReducedMotion();

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) ?? null,
    [categories, activeCategoryId],
  );

  const totalActiveCount = useMemo(() => {
    return Object.values(value).reduce((acc, curr) => acc + (curr?.length ?? 0), 0);
  }, [value]);

  function handleSelectCategory(catId: string) {
    setDirection("forward");
    setSearchQuery("");
    setActiveCategoryId(catId);
  }

  function handleBack() {
    setDirection("backward");
    setSearchQuery("");
    setActiveCategoryId(null);
  }

  function handleClearAll() {
    onChange({});
  }

  function handleClearCategory(catId: string) {
    const next = { ...value };
    delete next[catId];
    onChange(next);
  }

  function handleToggleOption(catId: string, optVal: string, mode: FilterSelectionMode) {
    const currentList = value[catId] ?? [];
    let nextList: string[];

    if (mode === "single") {
      nextList = currentList.includes(optVal) ? [] : [optVal];
    } else {
      nextList = currentList.includes(optVal)
        ? currentList.filter((v) => v !== optVal)
        : [...currentList, optVal];
    }

    const nextState = { ...value, [catId]: nextList };
    if (nextList.length === 0) {
      delete nextState[catId];
    }
    onChange(nextState);
  }

  function getCategorySummary(cat: FilterCategoryConfig): string | null {
    const selectedVals = value[cat.id] ?? [];
    if (selectedVals.length === 0) return null;
    const labels = selectedVals.map(
      (val) => cat.options.find((o) => o.value === val)?.label ?? val,
    );

    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")}, +${labels.length - 2}`;
  }

  const filteredOptions = useMemo(() => {
    if (!activeCategory) return [];
    if (!searchQuery.trim()) return activeCategory.options;
    const q = searchQuery.toLowerCase();
    return activeCategory.options.filter((o) => o.label.toLowerCase().includes(q));
  }, [activeCategory, searchQuery]);

  const slideVariants = {
    enter: (dir: "forward" | "backward") => ({
      x: shouldReduceMotion ? 0 : dir === "backward" ? -20 : 20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: "forward" | "backward") => ({
      x: shouldReduceMotion ? 0 : dir === "forward" ? -20 : 20,
      opacity: 0,
    }),
  };

  function handleClose() {
    setOpen(false);
    setActiveCategoryId(null);
    setSearchQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setActiveCategoryId(null);
          setSearchQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 rounded-xl transition-colors h-11 px-4 text-sm font-medium",
            totalActiveCount > 0
              ? "border-primary/50 bg-primary/10 text-primary font-semibold hover:bg-primary/15"
              : "text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          <Filter className="size-4" aria-hidden />
          <span>{triggerLabel}</span>
          {totalActiveCount > 0 && (
            <span className="flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {totalActiveCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={8}
        className="flex flex-col w-80 sm:w-88 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-xl max-w-[calc(100vw-1.5rem)]"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {!activeCategory ? (
            /* ================= ROOT PANEL ================= */
            <motion.div
              key="root"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col"
            >
              {/* Root Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-primary" aria-hidden />
                  <span className="text-sm font-bold text-foreground tracking-tight">{title}</span>
                  {totalActiveCount > 0 ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {totalActiveCount} active
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  {totalActiveCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors"
                    >
                      {clearAllLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Close filters"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Categories List */}
              <div className="flex max-h-[300px] flex-col gap-1 overflow-y-auto p-2.5">
                {categories.map((cat) => {
                  const summary = getCategorySummary(cat);
                  const hasSelected = (value[cat.id]?.length ?? 0) > 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat.id)}
                      className={cn(
                        "group flex min-h-[42px] items-center justify-between rounded-xl px-3.5 py-2 text-sm transition-colors text-left",
                        hasSelected ? "bg-muted/40 hover:bg-muted/60" : "hover:bg-muted/50 text-foreground",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      )}
                    >
                      <span className={cn("font-medium", hasSelected ? "text-foreground font-semibold" : "text-foreground/90")}>
                        {cat.label}
                      </span>
                      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                        {summary && (
                          <span className="max-w-[140px] truncate rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {summary}
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            /* ================= DRILL-DOWN SUB-PANEL ================= */
            <motion.div
              key={activeCategory.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col"
            >
              {/* Sub-panel Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <ChevronLeft className="size-4 text-muted-foreground" />
                  <span>{activeCategory.label}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  {(value[activeCategory.id]?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClearCategory(activeCategory.id)}
                      className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors px-1"
                    >
                      {clearLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Close filters"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* In-category Search input */}
              {activeCategory.searchable && (
                <div className="px-3 pt-3 pb-1">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={activeCategory.searchPlaceholder ?? searchPlaceholder}
                      className="h-9 rounded-xl bg-card pl-8.5 pr-8 text-xs border border-border/80 shadow-xs placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                        aria-label="Clear filter search"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Options list */}
              <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-2.5">
                {filteredOptions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {noMatchingOptionsText}
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = (value[activeCategory.id] ?? []).includes(opt.value);

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role={activeCategory.mode === "single" ? "radio" : undefined}
                        aria-checked={activeCategory.mode === "single" ? isSelected : undefined}
                        onClick={() =>
                          handleToggleOption(activeCategory.id, opt.value, activeCategory.mode)
                        }
                        className={cn(
                          "flex min-h-[40px] items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors text-left",
                          isSelected
                            ? "bg-primary/10 font-medium text-foreground"
                            : "hover:bg-muted/50 text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Radio Dot indicator for single mode */}
                          {activeCategory.mode === "single" && (
                            <div
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-card",
                              )}
                            >
                              {isSelected && (
                                <div className="size-1.5 rounded-full bg-primary-foreground" />
                              )}
                            </div>
                          )}

                          {/* Optional Color indicator dot */}
                          {opt.indicatorColor && (
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                opt.indicatorColor,
                              )}
                            />
                          )}

                          {/* Optional Icon */}
                          {opt.icon && (
                            <span className="shrink-0 text-muted-foreground">
                              {opt.icon}
                            </span>
                          )}

                          <span className="truncate">{opt.label}</span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {opt.badge !== undefined && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-normal tabular-nums">
                              {opt.badge}
                            </span>
                          )}

                          {/* Checkmark for multi-select mode */}
                          {activeCategory.mode === "multi" && isSelected && (
                            <Check className="size-4 text-primary stroke-[2.5] shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unified Popover Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {totalActiveCount > 0
              ? `${totalActiveCount} filter${totalActiveCount > 1 ? "s" : ""} active`
              : "No filters active"}
          </span>
          <Button
            size="sm"
            className="h-8 px-4 text-xs font-semibold rounded-lg"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Removable Filter Chips Bar rendered below the filter row */
export function DrilldownFilterChips({
  categories,
  value,
  onChange,
  onClearAll,
  clearAllLabel = "Clear all",
}: {
  categories: FilterCategoryConfig[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  onClearAll: () => void;
  clearAllLabel?: string;
}) {
  const activeChips = useMemo(() => {
    const list: { catId: string; catLabel: string; value: string; label: string }[] = [];
    for (const [catId, vals] of Object.entries(value)) {
      if (!vals || vals.length === 0) continue;
      const cat = categories.find((c) => c.id === catId);
      if (!cat) continue;
      for (const val of vals) {
        const opt = cat.options.find((o) => o.value === val);
        list.push({
          catId,
          catLabel: cat.label,
          value: val,
          label: opt?.label ?? val,
        });
      }
    }
    return list;
  }, [categories, value]);

  if (activeChips.length === 0) return null;

  function removeChip(catId: string, val: string) {
    const current = value[catId] ?? [];
    const nextList = current.filter((v) => v !== val);
    const next = { ...value, [catId]: nextList };
    if (nextList.length === 0) delete next[catId];
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {activeChips.map((chip) => (
        <Chip
          key={`${chip.catId}:${chip.value}`}
          variant="primary"
          subtle
          className="gap-1.5 pr-1.5 py-0.5 text-xs font-normal"
        >
          <span className="text-muted-foreground font-medium">{chip.catLabel}:</span>
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => removeChip(chip.catId, chip.value)}
            aria-label={`Remove ${chip.label}`}
            className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
          >
            <X className="size-3" />
          </button>
        </Chip>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors ml-1"
      >
        {clearAllLabel}
      </button>
    </div>
  );
}
