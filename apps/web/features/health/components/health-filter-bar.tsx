"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import {
  DrilldownFilterBar,
} from "@/components/shared/drilldown-filter-bar";
import type { FilterCategoryConfig } from "@/components/shared/drilldown-filter-popover";
import { useSheds } from "@/features/cattle/hooks/use-cattle";
import { useHealthDashboard } from "../hooks/use-health";
import { SICK_BAY_VIEWS, type SickBayView } from "../types";

const VIEW_KEYS = SICK_BAY_VIEWS as unknown as [SickBayView, ...SickBayView[]];

export function HealthFilterBar({
  view: controlledView,
  onViewChange,
  searchPlaceholder,
  actions,
}: {
  view?: SickBayView;
  onViewChange?: (view: SickBayView) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("health.filters");
  const tCenter = useTranslations("health.managementCenter");
  const sheds = useSheds();
  const dashboard = useHealthDashboard();

  // Query states
  const [queryView, setQueryView] = useQueryState("bay", parseAsStringEnum<SickBayView>(VIEW_KEYS).withDefault("cases"));
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));

  const activeView = controlledView ?? queryView;

  function handleViewChange(nextView: string) {
    if (onViewChange) {
      onViewChange(nextView as SickBayView);
    } else {
      void setQueryView(nextView as SickBayView);
    }
  }

  // Counts for scopes
  const counts: Partial<Record<SickBayView, number>> = {
    cases: dashboard.data?.sickBayCount,
    withheld: dashboard.data?.safetyWithdrawalCount,
  };



  // Specific query filters
  const [withdrawalStatus, setWithdrawalStatus] = useQueryState("withdrawalStatus", parseAsString);
  const [condition, setCondition] = useQueryState("condition", parseAsString);
  const [priority, setPriority] = useQueryState("priority", parseAsString);
  const [caseStatus, setCaseStatus] = useQueryState("caseStatus", parseAsString);
  const [shed, setShed] = useQueryState("shed", parseAsString);
  const [careType, setCareType] = useQueryState("careType", parseAsString);
  const [route, setRoute] = useQueryState("route", parseAsString);

  // Build filter categories
  const categories: FilterCategoryConfig[] = useMemo(() => {
    // 1. Primary "View / Scope" Category (available across all sub-views)
    const viewCategory: FilterCategoryConfig = {
      id: "view",
      label: t("categories.view"),
      mode: "single",
      options: [
        { value: "cases", label: t("view.cases"), badge: counts.cases },
        { value: "history", label: t("view.history") },
        { value: "withheld", label: t("view.withheld"), badge: counts.withheld },
      ],
    };

    if (activeView === "withheld") {
      return [
        viewCategory,
        {
          id: "withdrawalStatus",
          label: t("categories.withdrawalStatus"),
          mode: "single",
          options: [
            { value: "withholding", label: t("withdrawalStatus.withholding") },
            { value: "all", label: t("withdrawalStatus.all") },
          ],
        },
      ];
    }

    if (activeView === "history") {
      return [
        viewCategory,
        {
          id: "careType",
          label: t("categories.careType"),
          mode: "single",
          options: [
            { value: "PREVENTIVE", label: t("careType.PREVENTIVE") },
            { value: "CURATIVE", label: t("careType.CURATIVE") },
          ],
        },
        {
          id: "route",
          label: t("categories.route"),
          mode: "multi",
          options: [
            { value: "IM", label: t("route.IM") },
            { value: "IV", label: t("route.IV") },
            { value: "SC", label: t("route.SC") },
            { value: "ORAL", label: t("route.ORAL") },
            { value: "TOPICAL", label: t("route.TOPICAL") },
            { value: "OTHER", label: t("route.OTHER") },
          ],
        },
      ];
    }

    // Default: Sick Bay cases
    return [
      viewCategory,
      {
        id: "condition",
        label: t("categories.condition"),
        mode: "multi",
        searchable: true,
        searchPlaceholder: t("condition.searchPlaceholder"),
        options: [
          { value: "MASTITIS", label: t("condition.MASTITIS") },
          { value: "LAMENESS", label: t("condition.LAMENESS") },
          { value: "METRITIS", label: t("condition.METRITIS") },
          { value: "KETOSIS", label: t("condition.KETOSIS") },
          { value: "MILK_FEVER", label: t("condition.MILK_FEVER") },
          { value: "FEVER", label: t("condition.FEVER") },
          { value: "INJURY", label: t("condition.INJURY") },
          { value: "OTHER", label: t("condition.OTHER") },
        ],
      },
      {
        id: "priority",
        label: t("categories.priority"),
        mode: "single",
        options: [
          { value: "CRITICAL", label: t("priority.CRITICAL"), indicatorColor: "bg-destructive" },
          { value: "HIGH", label: t("priority.HIGH"), indicatorColor: "bg-warning" },
          { value: "MEDIUM", label: t("priority.MEDIUM"), indicatorColor: "bg-info" },
          { value: "LOW", label: t("priority.LOW"), indicatorColor: "bg-muted-foreground" },
        ],
      },
      {
        id: "caseStatus",
        label: t("categories.status"),
        mode: "multi",
        options: [
          { value: "ACTIVE", label: t("status.ACTIVE") },
          { value: "IMPROVING", label: t("status.IMPROVING") },
          { value: "STABLE", label: t("status.STABLE") },
          { value: "WORSENING", label: t("status.WORSENING") },
        ],
      },
      {
        id: "shed",
        label: t("categories.shed"),
        mode: "single",
        searchable: true,
        searchPlaceholder: t("searchPlaceholder"),
        options: (sheds.data?.items ?? []).map((s) => ({ value: s.name, label: s.name })),
      },
    ];
  }, [activeView, t, counts.cases, counts.withheld, sheds.data]);

  // Active filter values map
  const activeFilterValues: Record<string, string[]> = useMemo(() => {
    const values: Record<string, string[]> = {};
    if (activeView) values.view = [activeView];

    if (activeView === "withheld") {
      if (withdrawalStatus) values.withdrawalStatus = [withdrawalStatus];
    } else if (activeView === "history") {
      if (careType) values.careType = [careType];
      if (route) values.route = route.split(",").filter(Boolean);
    } else {
      if (condition) values.condition = condition.split(",").filter(Boolean);
      if (priority) values.priority = [priority];
      if (caseStatus) values.caseStatus = caseStatus.split(",").filter(Boolean);
      if (shed) values.shed = [shed];
    }
    return values;
  }, [activeView, withdrawalStatus, careType, route, condition, priority, caseStatus, shed]);

  // Handle updates from DrilldownFilterBar
  function handleFilterChange(next: Record<string, string[]>) {
    const targetView = (next.view?.[0] as SickBayView) || "cases";
    if (targetView !== activeView) {
      handleViewChange(targetView);
    }

    if (activeView === "withheld") {
      void setWithdrawalStatus(next.withdrawalStatus?.[0] || null);
    } else if (activeView === "history") {
      void setCareType(next.careType?.[0] || null);
      void setRoute(next.route?.length ? next.route.join(",") : null);
    } else {
      void setCondition(next.condition?.length ? next.condition.join(",") : null);
      void setPriority(next.priority?.[0] || null);
      void setCaseStatus(next.caseStatus?.length ? next.caseStatus.join(",") : null);
      void setShed(next.shed?.[0] || null);
    }
  }

  function handleClearAll() {
    handleViewChange("cases");
    if (activeView === "withheld") {
      void setWithdrawalStatus(null);
    } else if (activeView === "history") {
      void setCareType(null);
      void setRoute(null);
    } else {
      void setCondition(null);
      void setPriority(null);
      void setCaseStatus(null);
      void setShed(null);
    }
  }

  return (
    <DrilldownFilterBar
      search={search}
      onSearchChange={(q) => void setSearch(q || null)}
      searchPlaceholder={searchPlaceholder ?? tCenter("searchPlaceholder")}
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
