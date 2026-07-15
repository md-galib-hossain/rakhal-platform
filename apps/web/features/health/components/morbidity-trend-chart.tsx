"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip } from "@/components/ui/chip";
import { useHealthDashboard } from "../hooks/use-health";
import { HealthCard, PeriodPill } from "./health-card";

const MorbidityTrendChartInner = dynamic(() => import("./morbidity-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

/** Figma "Morbidity Trend Over Time" card (node 734:35720) — backed by the real
 * `health.service.ts#getHealthDashboard`'s `morbidityTrend` (health cases grouped by their
 * `startDate` day, all-time — not actually windowed to "last 30 days"; the period pill is a static
 * label rather than a wired range filter since the endpoint takes no date-range param). Direction
 * chip ("Decreasing"/"Increasing"/"Stable") is computed client-side by comparing the first and last
 * points — the backend doesn't compute or return a trend direction itself. */
export function MorbidityTrendChart() {
  const t = useTranslations("health.morbidityTrend");
  const query = useHealthDashboard();

  if (query.isLoading) return <CardSkeleton lines={6} className="h-full rounded-2xl" />;
  if (query.isError) {
    return (
      <HealthCard title={t("title")} className="flex-1">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </HealthCard>
    );
  }
  const points = query.data?.morbidityTrend ?? [];
  const first = points[0]?.count ?? 0;
  const last = points[points.length - 1]?.count ?? 0;
  const direction = points.length < 2 || first === last ? "stable" : last < first ? "decreasing" : "increasing";

  const trendChip =
    direction === "stable" ? null : (
      <Chip variant={direction === "decreasing" ? "primary" : "destructive"} className="gap-1">
        {direction === "decreasing" ? <TrendingDown className="size-3" aria-hidden /> : <TrendingUp className="size-3" aria-hidden />}
        {t(direction)}
      </Chip>
    );

  return (
    <HealthCard
      title={t("title")}
      titleExtra={trendChip}
      headerRight={<PeriodPill label={t("periodLabel")} />}
      className="flex-1"
    >
      <MorbidityTrendChartInner points={points} label={t("legend")} />
    </HealthCard>
  );
}
