"use client"; // live query + dynamic chart import

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/shared/chart-card";
import { ErrorState } from "@/components/shared/error-state";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useMilkOverview } from "@/features/milk/hooks/use-milk";
import type { MilkTrendRange } from "@/features/milk/types";
import { MilkTrendRangeSelect } from "@/features/milk/components/milk-trend-range-select";

const MilkTrendChartInner = dynamic(() => import("@/features/milk/components/milk-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

/** Dashboard-preview of the Milk page's "Production Trend Over Time" chart (`MilkTrendChart`) —
 * same `GET /milk/overview` query (TanStack Query dedupes with the Milk page's own call when both
 * are mounted with the same `range`), reusing `MilkTrendChartInner` directly rather than forking
 * the recharts config. Own range picker (7d/30d/3mo/6mo/1yr/lifetime) alongside the "View All"
 * link, independent of the Milk page's own picker. */
export function MilkTrendCard() {
  const t = useTranslations("dashboard.milkTrend");
  const [range, setRange] = useState<MilkTrendRange>("30d");
  const query = useMilkOverview(undefined, range);

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <ChartCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={t("title")}
      className="h-full"
      rangeControl={
        <div className="flex items-center gap-2">
          <MilkTrendRangeSelect value={range} onChange={setRange} />
          <Link href="/milk" className="text-xs font-medium text-primary hover:underline">
            {t("viewAll")}
          </Link>
        </div>
      }
    >
      <MilkTrendChartInner trend={query.data?.trend ?? []} label={t("title")} compact />
    </ChartCard>
  );
}
