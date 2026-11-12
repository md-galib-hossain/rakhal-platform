"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { DrilldownFilterBar } from "@/components/shared/drilldown-filter-bar";
import type { FilterCategoryConfig } from "@/components/shared/drilldown-filter-popover";
import { useAnimalGroups, useBreeds, useSheds } from "../hooks/use-cattle";

/**
 * Standardized hierarchical drilldown filter bar for the Animal module.
 * Adopts the unified project filter design (matching Healthcare / Sick Bay's `DrilldownFilterBar`).
 * URL-synced via `nuqs`, read back by `CattleTable` and synchronized with `CattleCategoryHighlights`.
 */
export function CattleFilters({
  actions,
  className,
}: {
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("cattle.filters");
  const tCategories = useTranslations("cattle.animalCategory");

  const breeds = useBreeds();
  const sheds = useSheds();
  const animalGroups = useAnimalGroups();

  // URL query states via nuqs
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [animalCategory, setAnimalCategory] = useQueryState("animalCategory", parseAsString);
  const [productionStatus, setProductionStatus] = useQueryState("productionStatus", parseAsString);
  const [herdStatus, setHerdStatus] = useQueryState("herdStatus", parseAsString);
  const [lifecycleSubStage, setLifecycleSubStage] = useQueryState("lifecycleSubStage", parseAsString);
  const [healthStatus, setHealthStatus] = useQueryState("healthStatus", parseAsString);
  const [dueFilter, setDueFilter] = useQueryState("dueFilter", parseAsString);
  const [breedId, setBreedId] = useQueryState("breedId", parseAsString);
  const [shedId, setShedId] = useQueryState("shedId", parseAsString);
  const [animalGroupId, setAnimalGroupId] = useQueryState("animalGroupId", parseAsString);

  // Hierarchical category configurations for the drilldown popover
  const categories: FilterCategoryConfig[] = useMemo(() => {
    return [
      {
        id: "animalCategory",
        label: t("animalCategory"),
        mode: "single",
        options: [
          { value: "CALF", label: tCategories("CALF") },
          { value: "HEIFER", label: tCategories("HEIFER") },
          { value: "COW", label: tCategories("COW") },
          { value: "BULL", label: tCategories("BULL") },
          { value: "STEER", label: tCategories("STEER") },
        ],
      },
      {
        id: "productionStatus",
        label: t("status"),
        mode: "single",
        options: [
          { value: "MILKING", label: t("statusOptions.milking") },
          { value: "DRY", label: t("statusOptions.dry") },
        ],
      },
      {
        id: "herdStatus",
        label: t("herdStatus"),
        mode: "single",
        options: [
          { value: "ACTIVE", label: t("herdStatusOptions.active"), indicatorColor: "bg-success" },
          { value: "SOLD", label: t("herdStatusOptions.sold"), indicatorColor: "bg-info" },
          { value: "CULLED", label: t("herdStatusOptions.culled"), indicatorColor: "bg-warning" },
          { value: "DECEASED", label: t("herdStatusOptions.deceased"), indicatorColor: "bg-destructive" },
        ],
      },
      {
        id: "lifecycleSubStage",
        label: t("lifecycleSubStage"),
        mode: "single",
        options: [
          { value: "WEANED_HEIFER", label: t("lifecycleSubStageOptions.weanedHeifer") },
          { value: "GROWING_HEIFER", label: t("lifecycleSubStageOptions.growingHeifer") },
          { value: "BREEDING_HEIFER", label: t("lifecycleSubStageOptions.breedingHeifer") },
          { value: "WEANER_BULL", label: t("lifecycleSubStageOptions.weanerBull") },
          { value: "GROWING_BULL", label: t("lifecycleSubStageOptions.growingBull") },
          { value: "MATURE_BULL", label: t("lifecycleSubStageOptions.matureBull") },
        ],
      },
      {
        id: "healthStatus",
        label: t("health"),
        mode: "single",
        options: [
          { value: "HEALTHY", label: t("healthOptions.healthy"), indicatorColor: "bg-success" },
          { value: "SICK", label: t("healthOptions.sick"), indicatorColor: "bg-destructive" },
          { value: "IN_TREATMENT", label: t("healthOptions.inTreatment"), indicatorColor: "bg-warning" },
          { value: "WITHHOLDING", label: t("healthOptions.withholding"), indicatorColor: "bg-muted-foreground" },
        ],
      },
      {
        id: "dueFilter",
        label: t("due"),
        mode: "single",
        options: [
          { value: "overdue", label: t("dueOptions.overdue"), indicatorColor: "bg-destructive" },
          { value: "today", label: t("dueOptions.today"), indicatorColor: "bg-warning" },
          { value: "week", label: t("dueOptions.week"), indicatorColor: "bg-info" },
        ],
      },
      {
        id: "breedId",
        label: t("breed"),
        mode: "single",
        searchable: true,
        searchPlaceholder: t("searchPlaceholder"),
        options: (breeds.data?.items ?? []).map((b) => ({ value: b.id, label: b.name })),
      },
      {
        id: "shedId",
        label: t("shed"),
        mode: "single",
        searchable: true,
        searchPlaceholder: t("searchPlaceholder"),
        options: (sheds.data?.items ?? []).map((s) => ({ value: s.id, label: s.name })),
      },
      {
        id: "animalGroupId",
        label: t("animalGroup"),
        mode: "single",
        searchable: true,
        searchPlaceholder: t("searchPlaceholder"),
        options: (animalGroups.data?.items ?? []).map((g) => ({ value: g.id, label: g.name })),
      },
    ];
  }, [t, tCategories, breeds.data, sheds.data, animalGroups.data]);

  // Active filter values map
  const activeFilterValues: Record<string, string[]> = useMemo(() => {
    const values: Record<string, string[]> = {};
    if (animalCategory) values.animalCategory = [animalCategory];
    if (productionStatus) values.productionStatus = [productionStatus];
    if (herdStatus) values.herdStatus = [herdStatus];
    if (lifecycleSubStage) values.lifecycleSubStage = [lifecycleSubStage];
    if (healthStatus) values.healthStatus = [healthStatus];
    if (dueFilter) values.dueFilter = [dueFilter];
    if (breedId) values.breedId = [breedId];
    if (shedId) values.shedId = [shedId];
    if (animalGroupId) values.animalGroupId = [animalGroupId];
    return values;
  }, [
    animalCategory,
    productionStatus,
    herdStatus,
    lifecycleSubStage,
    healthStatus,
    dueFilter,
    breedId,
    shedId,
    animalGroupId,
  ]);

  // Handle drilldown filter updates
  function handleFilterChange(next: Record<string, string[]>) {
    void setAnimalCategory(next.animalCategory?.[0] || null);
    void setProductionStatus(next.productionStatus?.[0] || null);
    void setHerdStatus(next.herdStatus?.[0] || null);
    void setLifecycleSubStage(next.lifecycleSubStage?.[0] || null);
    void setHealthStatus(next.healthStatus?.[0] || null);
    void setDueFilter(next.dueFilter?.[0] || null);
    void setBreedId(next.breedId?.[0] || null);
    void setShedId(next.shedId?.[0] || null);
    void setAnimalGroupId(next.animalGroupId?.[0] || null);
  }

  // Handle clearing all active filters
  function handleClearAll() {
    void setAnimalCategory(null);
    void setProductionStatus(null);
    void setHerdStatus(null);
    void setLifecycleSubStage(null);
    void setHealthStatus(null);
    void setDueFilter(null);
    void setBreedId(null);
    void setShedId(null);
    void setAnimalGroupId(null);
  }

  return (
    <DrilldownFilterBar
      className={className}
      search={search}
      onSearchChange={(q) => void setSearch(q || null)}
      searchPlaceholder={t("searchPlaceholder")}
      categories={categories}
      filterValues={activeFilterValues}
      onFilterChange={handleFilterChange}
      onClearAllFilters={handleClearAll}
      filterTriggerLabel={t("trigger")}
      filterPopoverTitle={t("title")}
      actions={actions}
    />
  );
}
