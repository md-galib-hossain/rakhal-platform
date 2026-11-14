"use client"; // live query + dynamic chart import

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/shared/chart-card";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { useMilkOverview } from "../hooks/use-milk";
import type { MilkTrendRange } from "../types";
import { MilkTrendRangeSelect } from "./milk-trend-range-select";

const MilkTrendChartInner = dynamic(() => import("./milk-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

/** "Production Trend Over Time" (Figma node 734:32384) — backed by the real `GET /milk/overview`
 * query (same one `MilkKeyMetricsCard` uses when `range` matches, TanStack Query dedupes those).
 * Figma's static "Monthly" range label is replaced with a real picker (7d/30d/3mo/6mo/1yr/lifetime)
 * now the backend's `range` param (`MilkService#trend`) actually supports more than a fixed 30 days. */
export function MilkTrendChart() {
  const t = useTranslations("milk.trend");
  const [range, setRange] = useState<MilkTrendRange>("30d");
  const query = useMilkOverview(undefined, range);

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
      rangeControl={<MilkTrendRangeSelect value={range} onChange={setRange} />}
    >
      <MilkTrendChartInner trend={query.data?.trend ?? []} label={t("legend")} />
    </ChartCard>
  );
}
