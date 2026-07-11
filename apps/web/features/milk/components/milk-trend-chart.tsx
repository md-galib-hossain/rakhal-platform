"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMilkOverview } from "../hooks/use-milk";
import { MilkCard } from "./milk-card";

const MilkTrendChartInner = dynamic(() => import("./milk-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

/** 30-day litres trend — backed by the same `GET /milk/overview` query as `MilkOverviewCard`
 * (TanStack Query dedupes the two calls into one network request). */
export function MilkTrendChart() {
  const t = useTranslations("milk.trend");
  const query = useMilkOverview();

  if (query.isLoading) return <CardSkeleton lines={6} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <MilkCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </MilkCard>
    );
  }

  return (
    <MilkCard title={t("title")}>
      <MilkTrendChartInner trend={query.data?.trend30Days ?? []} label={t("legend")} />
    </MilkCard>
  );
}
