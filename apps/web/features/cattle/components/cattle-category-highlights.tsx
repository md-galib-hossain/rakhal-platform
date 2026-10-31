"use client"; // URL-synced selection + per-category count queries

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCattleCategoryCounts } from "../hooks/use-cattle";
import { CATTLE_CATEGORY_CHIPS, type CattleCategoryChip, type CattleListFilters } from "../types";

type ChipKey = "ALL" | CattleCategoryChip;

const CHIPS: { key: ChipKey; filters: CattleListFilters }[] = [
  { key: "ALL", filters: {} },
  ...CATTLE_CATEGORY_CHIPS.map((key) => ({ key, filters: { category: key } as CattleListFilters })),
];

/**
 * RFE-163 — scrolling category chips with live counts (04 §6), replacing the 8 KPI tiles. A chip writes the `category`
 * URL param (`GET /cattle?category=`, RAKHAL-480); "All" clears it. The older `productionStatus` / `animalCategory` /
 * `reproductiveStatus` params are cleared on pick so a stale bookmarked URL cannot stack with the chip. Counts come
 * from a 100-row page, so a bigger group reads "100+".
 */
export function CattleCategoryHighlights() {
  const t = useTranslations("events.bulk");
  const [category, setCategory] = useQueryState("category", parseAsString);
  const [, setProductionStatus] = useQueryState("productionStatus", parseAsString);
  const [, setAnimalCategory] = useQueryState("animalCategory", parseAsString);
  const [, setReproductiveStatus] = useQueryState("reproductiveStatus", parseAsString);
  const counts = useCattleCategoryCounts(CHIPS.map(({ key, filters }) => ({ key: `chip-${key}`, filters })));
  const active: ChipKey = CHIPS.some((chip) => chip.key === category) ? (category as ChipKey) : "ALL";

  function pick(key: ChipKey) {
    void setCategory(key === "ALL" ? null : key);
    void setProductionStatus(null);
    void setAnimalCategory(null);
    void setReproductiveStatus(null);
  }

  return (
    <div role="group" aria-label={t("categoryLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {CHIPS.map((chip, i) => {
        const isActive = chip.key === active;
        const result = counts[i];
        const page = result.data;
        const count = page ? (page.meta.hasNextPage ? `${page.items.length}+` : String(page.items.length)) : "0";
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => pick(chip.key)}
            aria-pressed={isActive}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
              isActive ? "border-primary bg-primary-tint font-semibold text-primary" : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {t(`category.${chip.key}` as never)}
            {result.isLoading ? <Skeleton className="h-4 w-6" /> : <span className="tabular-nums text-muted-foreground">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
