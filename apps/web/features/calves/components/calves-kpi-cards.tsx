"use client"; // live query

import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarClock, Utensils } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import { useCalvesPagedList } from "../hooks/use-calves";

/** Three headline KPIs (RFE-033, no Figma frame) from `GET /calves`'s `meta.kpis` — tile grid/icon-chip
 * pattern copied from Reproduction's `ReproductionKpiCards`. Farm-wide, unfiltered — the KPI row
 * always reflects the whole herd regardless of the table's active stage/health filter. `totalCalves`
 * dropped from here — the Animal page's own Calf category tile already shows that count when this
 * banner is visible (banner only renders while filtered to `animalCategory=CALF`). */
export function CalvesKpiCards() {
  const t = useTranslations("calves.kpi");
  const query = useCalvesPagedList({});

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label={t("fedToday")}
        value={query.kpis.fedToday}
        icon={<Utensils className="size-4" aria-hidden />}
        iconClassName="bg-success-tint text-success"
      />
      <StatCard
        label={t("healthConcern")}
        value={query.kpis.healthConcern}
        icon={<AlertTriangle className="size-4" aria-hidden />}
        iconClassName="bg-destructive-tint text-destructive"
      />
      <StatCard
        label={t("weaningDueThisWeek")}
        value={query.kpis.weaningDueThisWeek}
        icon={<CalendarClock className="size-4" aria-hidden />}
        iconClassName="bg-warning-tint text-warning"
      />
    </div>
  );
}
