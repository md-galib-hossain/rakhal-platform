"use client"; // URL-synced category pills via nuqs

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CategoryKey = "all" | "milking" | "dry" | "heifer" | "calf";

/** Each category maps onto one of the three enum filters the backend's `ListCattleQueryDto`
 * already supports (`productionStatus`/`reproductiveStatus`/`purpose` — no backend change). Only
 * one dimension is set at a time; picking a category clears the other two so the tabs and the
 * existing `CattleFilters` "Filter" popover (same URL params) never fight each other. */
const CATEGORY_PARAMS: Record<Exclude<CategoryKey, "all">, { key: "productionStatus" | "reproductiveStatus" | "purpose"; value: string }> = {
  milking: { key: "productionStatus", value: "MILKING" },
  dry: { key: "productionStatus", value: "DRY" },
  heifer: { key: "reproductiveStatus", value: "HEIFER" },
  calf: { key: "purpose", value: "CALF" },
};

const CATEGORY_ORDER: CategoryKey[] = ["all", "milking", "dry", "heifer", "calf"];

/** Quick-filter pill row above "All Cattle View" (RFE — user request: click "Heifer" and the
 * table below filters to heifers). URL-synced via `nuqs`, same param keys `CattleFilters`'s
 * select dropdowns write, so both controls stay in sync in either direction. */
export function CattleCategoryTabs() {
  const t = useTranslations("cattle.categories");
  const [productionStatus, setProductionStatus] = useQueryState("productionStatus", parseAsString);
  const [reproductiveStatus, setReproductiveStatus] = useQueryState("reproductiveStatus", parseAsString);
  const [purpose, setPurpose] = useQueryState("purpose", parseAsString);

  const active: CategoryKey =
    (Object.entries(CATEGORY_PARAMS).find(([, cfg]) => {
      const current = cfg.key === "productionStatus" ? productionStatus : cfg.key === "reproductiveStatus" ? reproductiveStatus : purpose;
      return current === cfg.value;
    })?.[0] as CategoryKey | undefined) ?? "all";

  function selectCategory(next: CategoryKey) {
    void setProductionStatus(next === "milking" || next === "dry" ? CATEGORY_PARAMS[next].value : null);
    void setReproductiveStatus(next === "heifer" ? CATEGORY_PARAMS[next].value : null);
    void setPurpose(next === "calf" ? CATEGORY_PARAMS[next].value : null);
  }

  return (
    <Tabs value={active} onValueChange={(v) => selectCategory(v as CategoryKey)}>
      <TabsList className="flex-wrap">
        {CATEGORY_ORDER.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(key)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
