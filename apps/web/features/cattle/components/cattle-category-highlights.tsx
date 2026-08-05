"use client"; // URL-synced selection + per-category count queries

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Ban, Baby, Milk, Users, Venus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCattleCategoryCounts } from "../hooks/use-cattle";
import type { CattleListFilters } from "../types";

type CategoryKey = "all" | "milking" | "dry" | "heifer" | "calf";

/** Each category maps onto one of the three enum filters the backend's `ListCattleQueryDto`
 * already supports (`productionStatus`/`reproductiveStatus`/`purpose` — no backend change). Only
 * one dimension is set at a time; picking a tile clears the other two so this control and the
 * existing `CattleFilters` "Filter" popover (same URL params) never fight each other. */
const CATEGORIES: { key: CategoryKey; filters: CattleListFilters; icon: React.ComponentType<{ className?: string }>; iconBg: string; iconFg: string }[] = [
  { key: "all", filters: {}, icon: Users, iconBg: "bg-accent-indigo-tint", iconFg: "text-accent-indigo" },
  { key: "milking", filters: { productionStatus: "MILKING" }, icon: Milk, iconBg: "bg-success-tint", iconFg: "text-success" },
  { key: "dry", filters: { productionStatus: "DRY" }, icon: Ban, iconBg: "bg-muted", iconFg: "text-muted-foreground" },
  // RAKHAL-271 v2 dropped the standalone HEIFER reproductive state (the backend's
  // `ReproductionState` no longer has a heifer-specific value) — `NOT_ELIGIBLE` is the closest
  // real proxy (immature/not-yet-bred females), even though it also covers other not-yet-eligible
  // cases. Kept the "heifer" label as-is (no new UI for this fix) since it's still the dominant
  // real-world case for this tile.
  { key: "heifer", filters: { reproductiveStatus: "NOT_ELIGIBLE" }, icon: Venus, iconBg: "bg-accent-purple-tint", iconFg: "text-accent-purple" },
  { key: "calf", filters: { purpose: "CALF" }, icon: Baby, iconBg: "bg-info-tint", iconFg: "text-info" },
];

/** Clickable KPI-tile row (same "Cattle Highlights" card visual language, not the earlier pill
 * tabs) — picking "Milking" filters "All Cattle View" below to milking cows; "All" (the default,
 * no query params set) shows everything. URL-synced via `nuqs`, same param keys `CattleFilters`'s
 * select dropdowns write, so both controls stay in sync in either direction. */
export function CattleCategoryHighlights() {
  const t = useTranslations("cattle.categories");
  const [productionStatus, setProductionStatus] = useQueryState("productionStatus", parseAsString);
  const [reproductiveStatus, setReproductiveStatus] = useQueryState("reproductiveStatus", parseAsString);
  const [purpose, setPurpose] = useQueryState("purpose", parseAsString);
  const counts = useCattleCategoryCounts(CATEGORIES);

  const active: CategoryKey =
    CATEGORIES.find((c) => {
      if (c.key === "all") return false;
      if (c.filters.productionStatus) return productionStatus === c.filters.productionStatus;
      if (c.filters.reproductiveStatus) return reproductiveStatus === c.filters.reproductiveStatus;
      if (c.filters.purpose) return purpose === c.filters.purpose;
      return false;
    })?.key ?? "all";

  function selectCategory(next: CategoryKey) {
    const cfg = CATEGORIES.find((c) => c.key === next)!;
    void setProductionStatus(cfg.filters.productionStatus ?? null);
    void setReproductiveStatus(cfg.filters.reproductiveStatus ?? null);
    void setPurpose(cfg.filters.purpose ?? null);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {CATEGORIES.map((category, i) => {
        const Icon = category.icon;
        const isActive = category.key === active;
        const result = counts[i];
        return (
          <button
            key={category.key}
            type="button"
            onClick={() => selectCategory(category.key)}
            aria-pressed={isActive}
            className={cn(
              "flex flex-1 flex-col justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
              isActive ? "border-primary bg-primary-tint" : "border-border bg-card hover:bg-muted",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", category.iconBg)}>
                <Icon className={cn("size-4", category.iconFg)} />
              </span>
              <p className="text-sm font-medium text-foreground">{t(category.key)}</p>
            </div>
            {result.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {result.data ? (result.data.meta.hasNextPage ? `${result.data.items.length}+` : result.data.items.length) : 0}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
