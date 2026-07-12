"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/shared/chart-card";
import { ErrorState } from "@/components/shared/error-state";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useMilkOverview } from "../hooks/use-milk";

const MilkTrendChartInner = dynamic(() => import("./milk-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

/** "Production Trend Over Time" (Figma node 734:32384) — backed by the same `GET /milk/overview`
 * query as `MilkKeyMetricsCard` (TanStack Query dedupes the two calls into one network request).
 * Figma's chart is a yearly Jan–Dec rollup with a "Monthly" period switcher; the real backend only
 * has a 30-day daily trend, so the range control is a static label rather than a picker with options
 * that don't exist. */
export function MilkTrendChart() {
  const t = useTranslations("milk.trend");
  const query = useMilkOverview();

  if (query.isLoading) return <CardSkeleton lines={6} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <ChartCard title={t("title")} className="h-full">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={t("title")}
      className="h-full"
      rangeControl={
        <span className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
          {t("rangeLabel")}
        </span>
      }
    >
      <MilkTrendChartInner trend={query.data?.trend30Days ?? []} label={t("legend")} />
    </ChartCard>
  );
}
