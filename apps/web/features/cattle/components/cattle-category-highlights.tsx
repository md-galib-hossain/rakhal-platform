"use client"; // URL-synced selection + per-category count queries

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Ban, Baby, Milk, Users, Venus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCattleCategoryCounts } from "../hooks/use-cattle";
import type { CattleListFilters } from "../types";

type CategoryKey = "all" | "milking" | "dry" | "heifer" | "calf";

/**
 * RAKHAL-282/283/284: "milking"/"dry" still map onto a real backend query filter
 * (`productionStatus`, `ListCattleQueryDto`) — unchanged.
 *
 * RAKHAL-289: "heifer"/"calf" used to proxy off `reproductiveStatus: "NOT_ELIGIBLE"` /
 * `purpose: "CALF"` for both the tile's count *and* its click-through table filter — a real bug,
 * since heifers with no `ReproductionProfile` row at all (a null relation, not `NOT_ELIGIBLE`)
 * were silently excluded from the click-through. The backend now exposes a real
 * `animalCategory` query param (`ListCattleQueryDto.animalCategory`, confirmed by reading
 * `list-cattle-query.dto.ts` directly — mirrors `deriveAnimalCategory()` server-side), so both
 * `filters` (click-through) and `countFilters` (tile count) use it directly for heifer/calf now.
 * `category` is kept `null` for these two tiles too — the server-side filter is now exact, so the
 * client-side `countByCategory()` recompute is no longer needed (page-count fallback below applies
 * uniformly, same as the other real-field tiles).
 */
const CATEGORIES: {
  key: CategoryKey;
  /** Query params sent when the tile is *clicked* (drives "All Cattle View" below) *and* for the
   * tile's own *count* query — every tile now maps onto a real, exact backend filter param. */
  filters: CattleListFilters;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconFg: string;
}[] = [
  { key: "all", filters: {}, icon: Users, iconBg: "bg-accent-indigo-tint", iconFg: "text-accent-indigo" },
  { key: "milking", filters: { productionStatus: "MILKING" }, icon: Milk, iconBg: "bg-success-tint", iconFg: "text-success" },
  { key: "dry", filters: { productionStatus: "DRY" }, icon: Ban, iconBg: "bg-muted", iconFg: "text-muted-foreground" },
  { key: "heifer", filters: { animalCategory: "HEIFER" }, icon: Venus, iconBg: "bg-accent-purple-tint", iconFg: "text-accent-purple" },
  { key: "calf", filters: { animalCategory: "CALF" }, icon: Baby, iconBg: "bg-info-tint", iconFg: "text-info" },
];

/** Clickable KPI-tile row (same "Cattle Highlights" card visual language, not the earlier pill
 * tabs) — picking "Milking" filters "All Cattle View" below to milking cows; "All" (the default,
 * no query params set) shows everything. URL-synced via `nuqs`, same param keys `CattleFilters`'s
 * select dropdowns write, so both controls stay in sync in either direction. */
export function CattleCategoryHighlights() {
  const t = useTranslations("cattle.categories");
  const [productionStatus, setProductionStatus] = useQueryState("productionStatus", parseAsString);
  const [animalCategory, setAnimalCategory] = useQueryState("animalCategory", parseAsString);
  // Cleared (not read) on select below — no longer written by this component (RAKHAL-289 dropped
  // the reproductiveStatus/purpose proxies) but a stale bookmarked/shared URL could still carry
  // one, which would otherwise silently stack with the new animalCategory filter.
  const [, setReproductiveStatus] = useQueryState("reproductiveStatus", parseAsString);
  const [, setPurpose] = useQueryState("purpose", parseAsString);
  const counts = useCattleCategoryCounts(CATEGORIES.map(({ key, filters }) => ({ key, filters })));

  const active: CategoryKey =
    CATEGORIES.find((c) => {
      if (c.key === "all") return false;
      if (c.filters.productionStatus) return productionStatus === c.filters.productionStatus;
      if (c.filters.animalCategory) return animalCategory === c.filters.animalCategory;
      return false;
    })?.key ?? "all";

  function selectCategory(next: CategoryKey) {
    const cfg = CATEGORIES.find((c) => c.key === next)!;
    void setProductionStatus(cfg.filters.productionStatus ?? null);
    void setAnimalCategory(cfg.filters.animalCategory ?? null);
    void setReproductiveStatus(null);
    void setPurpose(null);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {CATEGORIES.map((cfg, i) => {
        const Icon = cfg.icon;
        const isActive = cfg.key === active;
        const result = counts[i];
        return (
          <button
            key={cfg.key}
            type="button"
            onClick={() => selectCategory(cfg.key)}
            aria-pressed={isActive}
            className={cn(
              "flex flex-1 flex-col justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
              isActive ? "border-primary bg-primary-tint" : "border-border bg-card hover:bg-muted",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", cfg.iconBg)}>
                <Icon className={cn("size-4", cfg.iconFg)} />
              </span>
              <p className="text-sm font-medium text-foreground">{t(cfg.key)}</p>
            </div>
            {result.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {result.data
                  ? result.data.meta.hasNextPage
                    ? `${result.data.items.length}+`
                    : result.data.items.length
                  : 0}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
