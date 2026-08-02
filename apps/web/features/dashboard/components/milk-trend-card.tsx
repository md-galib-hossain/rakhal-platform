"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/shared/chart-card";
import { ErrorState } from "@/components/shared/error-state";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useMilkOverview } from "@/features/milk/hooks/use-milk";

const MilkTrendChartInner = dynamic(() => import("@/features/milk/components/milk-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

/** Dashboard-preview of the Milk page's "Production Trend Over Time" chart (`MilkTrendChart`) —
 * same `GET /milk/overview` query (TanStack Query dedupes with the Milk page's own call when both
 * are mounted), reusing `MilkTrendChartInner` directly rather than forking the recharts config. */
export function MilkTrendCard() {
  const t = useTranslations("dashboard.milkTrend");
  const query = useMilkOverview();

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
      rangeControl={
        <Link href="/milk" className="text-xs font-medium text-primary hover:underline">
          {t("viewAll")}
        </Link>
      }
    >
      <MilkTrendChartInner trend={query.data?.trend30Days ?? []} label={t("title")} />
    </ChartCard>
  );
}
