"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { useMorbidityTrend } from "../hooks/use-health";
import { HealthCard } from "./health-card";
import { rangeDays, type InsightsRange } from "./insights-range";

const MorbidityTrendChartInner = dynamic(() => import("./morbidity-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

/** Figma "Morbidity Trend Over Time" card (node 734:35720) — backed by `GET /health/morbidity-trend` (RAKHAL-471's
 * windowed, zero-filled, day / week / month series of curative cases by start date). The period comes from the
 * Insights tab's shared range picker. The direction chip compares this period's total with the equally long period
 * right before it (computed by the server), so it reads "down 25 % vs the 90 days before" instead of guessing from the
 * first and last points; "All time" has nothing to compare against, so it shows no chip. */
export function MorbidityTrendChart({ plain, range }: { plain?: boolean; range: InsightsRange }) {
  const t = useTranslations("health.morbidityTrend");
  const days = rangeDays(range);
  const query = useMorbidityTrend(days);

  if (query.isLoading) return <CardSkeleton lines={6} className="h-full rounded-2xl" />;
  if (query.isError || !query.data) {
    return (
      <HealthCard title={t("title")} className="flex-1" plain={plain}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </HealthCard>
    );
  }

  const { total, previousTotal, bucket, points } = query.data;
  const hasComparison = previousTotal !== null && (total > 0 || previousTotal > 0);
  const direction = !hasComparison || total === previousTotal ? "stable" : total < previousTotal! ? "decreasing" : "increasing";
  const percent = previousTotal ? Math.round((Math.abs(total - previousTotal) / previousTotal) * 100) : null;

  const trendChip =
    direction === "stable" ? null : (
      <Chip variant={direction === "decreasing" ? "primary" : "destructive"} className="gap-1">
        {direction === "decreasing" ? <TrendingDown className="size-3" aria-hidden /> : <TrendingUp className="size-3" aria-hidden />}
        {percent === null ? t(direction) : t("changeChip", { direction: t(direction), percent })}
      </Chip>
    );

  return (
    <HealthCard title={t("title")} titleExtra={trendChip} className="flex-1" plain={plain}>
      <div className={cn("flex flex-col gap-4 transition-opacity", query.isFetching && "opacity-70")}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-2xl font-bold text-foreground">{total}</span>
          <span className="text-sm text-muted-foreground">{t("casesInPeriod", { count: total })}</span>
          {previousTotal !== null ? (
            <span className="text-xs text-muted-foreground">· {t("previousPeriod", { count: previousTotal })}</span>
          ) : null}
        </div>
        {total === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} className="py-8" />
        ) : (
          <>
            <MorbidityTrendChartInner points={points} bucket={bucket} label={t("legend")} weekOfLabel={t("weekOf")} />
            <p className="text-xs text-muted-foreground">{t(`bucket.${bucket}`)}</p>
          </>
        )}
      </div>
    </HealthCard>
  );
}
