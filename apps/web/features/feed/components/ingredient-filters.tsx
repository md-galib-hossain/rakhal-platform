"use client"; // URL-synced filters via the shared FilterBar + a price-range pair (nuqs)

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { FilterBar } from "@/components/shared/filter-bar";
import { Input } from "@rakhal/ui/ui/input";

const CLASSES = ["FORAGE", "CONCENTRATE", "MINERAL", "VITAMIN", "ADDITIVE", "OTHER"] as const;

/** One numeric URL-synced field (`priceMin`/`priceMax`) — mirrors `FilterBar`'s internal
 * `SearchInput`'s debounce-then-sync pattern (no shared range-input component exists yet
 * elsewhere in the frontend, per the Inventory pagination pattern this mirrors). */
function PriceBoundInput({ paramKey, placeholder }: { paramKey: string; placeholder: string }) {
  const [value, setValue] = useQueryState(paramKey, parseAsString);
  const [draft, setDraft] = useState(value ?? "");
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value ?? "");
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (value ?? "")) void setValue(draft || null);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-24 h-11"
    />
  );
}

/** Search + class checklist + price/kg range — Ingredients management table's filter row
 * (2026-08-14, user request; 2026-08-15 class filter upgraded from single-select to the reusable
 * multi-select `FilterBar` checklist — a farm often wants "Forage + Mineral" at once, not one
 * class at a time). Price range is a plain pair of number inputs passed via `FilterBar`'s `extra`
 * slot since no shared range-input control exists. */
export function IngredientFilters({ actions }: { actions?: React.ReactNode }) {
  const t = useTranslations("feed.ingredientsManager.filters");

  return (
    <FilterBar
      layout="split"
      searchKey="search"
      searchPlaceholder={t("searchPlaceholder")}
      checklists={[
        {
          key: "feedClass",
          label: t("class"),
          options: CLASSES.map((feedClass) => ({ value: feedClass, label: t(`classOptions.${feedClass}`) })),
        },
      ]}
      extra={
        <>
          <div className="flex items-center gap-1.5" aria-label={t("priceRange")}>
            <PriceBoundInput paramKey="priceMin" placeholder={t("priceMinPlaceholder")} />
            <span className="text-muted-foreground">–</span>
            <PriceBoundInput paramKey="priceMax" placeholder={t("priceMaxPlaceholder")} />
          </div>
          {actions}
        </>
      }
    />
  );
}
