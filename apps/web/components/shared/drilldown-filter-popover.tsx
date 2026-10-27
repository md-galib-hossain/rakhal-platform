"use client";

import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft, Search, Check, Filter, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
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

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          // Reset view to root when closed
          setTimeout(() => {
            setActiveCategoryId(null);
            setSearchQuery("");
          }, 150);
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
        className="w-80 sm:w-88 overflow-hidden rounded-2xl border border-border/80 bg-card p-0 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
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
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col p-4.5"
            >
              <div className="flex items-center justify-between pb-3">
                <span className="text-[15px] font-semibold text-foreground tracking-tight">{title}</span>
                {totalActiveCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                  >
                    {clearAllLabel}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground/40 font-medium">
                    {clearAllLabel}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-col gap-1">
                {categories.map((cat) => {
                  const summary = getCategorySummary(cat);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat.id)}
                      className="group flex min-h-[44px] items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left"
                    >
                      <span className="font-medium text-foreground">{cat.label}</span>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {summary && (
                          <span className="max-w-[145px] truncate text-xs text-muted-foreground font-normal">
                            {summary}
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
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
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col p-4.5"
            >
              {/* Sub-panel Header with Back chevron */}
              <div className="flex items-center justify-between pb-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 text-[15px] font-semibold text-foreground hover:text-primary transition-colors -ml-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg px-1"
                >
                  <ChevronLeft className="size-4 text-muted-foreground" />
                  <span>{activeCategory.label}</span>
                </button>
                {(value[activeCategory.id]?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleClearCategory(activeCategory.id)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                  >
                    {clearLabel}
                  </button>
                )}
              </div>

              {/* In-category Search input */}
              {activeCategory.searchable && (
                <div className="relative mt-1 mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeCategory.searchPlaceholder ?? searchPlaceholder}
                    className="h-9 rounded-xl bg-muted/50 pl-8.5 pr-8 text-xs border-0 focus-visible:ring-1 focus-visible:ring-emerald-500/60 shadow-none placeholder:text-muted-foreground/60"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Options list */}
              <div className="mt-1 flex max-h-64 flex-col gap-0.5 overflow-y-auto pr-0.5">
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
                        onClick={() =>
                          handleToggleOption(activeCategory.id, opt.value, activeCategory.mode)
                        }
                        className={cn(
                          "flex min-h-[40px] items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left",
                          isSelected
                            ? "bg-muted/40 font-medium text-foreground"
                            : "hover:bg-muted/50 text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Radio Dot indicator for single mode (reference Card 2) */}
                          {activeCategory.mode === "single" && (
                            <div
                              className={cn(
                                "flex size-4.5 shrink-0 items-center justify-center rounded-full transition-colors",
                                isSelected
                                  ? "border-2 border-emerald-600 dark:border-emerald-500 bg-transparent"
                                  : "border border-muted-foreground/40 bg-transparent",
                              )}
                            >
                              {isSelected && (
                                <div className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-500" />
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
                            <span className="text-xs text-muted-foreground font-normal tabular-nums">
                              {opt.badge}
                            </span>
                          )}

                          {/* Emerald Checkmark for multi-select mode (reference Card 3) */}
                          {activeCategory.mode === "multi" && isSelected && (
                            <Check className="size-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5] shrink-0" />
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
