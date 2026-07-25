"use client"; // live query

import { useTranslations } from "next-intl";
import { Activity, Baby, CalendarClock, HeartPulse } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import { useReproductionDashboard } from "../hooks/use-reproduction";

/** Four headline KPIs (PRD §9.2) from the real `GET /reproduction/dashboard` — no Figma frames for
 * this module, so the tile grid/icon-chip pattern is copied from the Milk module's KPI row
 * (`MilkKeyMetricsCard`) rather than invented. Any `null` KPI (e.g. no active female herd yet) shows
 * "—" instead of a fake 0%. */
export function ReproductionKpiCards() {
  const t = useTranslations("reproduction.kpi");
  const dashboard = useReproductionDashboard();

  if (dashboard.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (dashboard.isError) {
    return <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />;
  }

  const kpis = dashboard.data?.kpis;
  const pct = (v: number | null | undefined) => (v != null ? `${v}%` : "—");
  const days = (v: number | null | undefined) => (v != null ? t("daysValue", { value: v }) : "—");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("heatDetectionRate")}
        value={pct(kpis?.heat_detection_rate_pct)}
        icon={<HeartPulse className="size-4" aria-hidden />}
        iconClassName="bg-accent-pink-tint text-accent-pink"
      />
      <StatCard
        label={t("conceptionRate")}
        value={pct(kpis?.conception_rate_pct)}
        icon={<Activity className="size-4" aria-hidden />}
        iconClassName="bg-success-tint text-success"
      />
      <StatCard
        label={t("pregnancyRate")}
        value={pct(kpis?.pregnancy_rate_pct)}
        icon={<Baby className="size-4" aria-hidden />}
        iconClassName="bg-info-tint text-info"
      />
      <StatCard
        label={t("avgCalvingInterval")}
        value={days(kpis?.avg_calving_interval_days)}
        icon={<CalendarClock className="size-4" aria-hidden />}
        iconClassName="bg-warning-tint text-warning"
      />
    </div>
  );
}
