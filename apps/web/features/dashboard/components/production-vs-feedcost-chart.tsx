"use client"; // live query + dynamic chart import

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { useProductionVsFeedcost } from "../hooks/use-dashboard-widgets";
import { DashboardCard, PeriodPill } from "./dashboard-card";

const loadProductionVsFeedcostChart = () => import("./production-vs-feedcost-chart-inner");
const ProductionVsFeedcostChartInner = dynamic(loadProductionVsFeedcostChart, {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

/** Figma-exact colors (node 732:2017) — kept in sync with `production-vs-feedcost-chart-inner.tsx`. */
const LEGEND = [
  { key: "production", color: "var(--chart-production)" },
  { key: "feedcost", color: "var(--chart-feedcost)" },
] as const;

/** Matches the Figma "Production vs Feedcost" card: current-month daily milk yield vs feed
 * distribution cost, backed by the real `GET /dashboard/production-vs-feedcost` route (`MilkLogEntry`
 * + `FeedDistribution` sums per day — see `dashboard.service.ts#productionVsFeedcost`). */
export function ProductionVsFeedcostChart() {
  const t = useTranslations("dashboard.productionVsFeedcost");
  const query = useProductionVsFeedcost();

  const headerRight = <PeriodPill label={t("periodLabel")} />;

  useEffect(() => {
    void loadProductionVsFeedcostChart();
  }, []);

  if (query.isLoading) return <CardSkeleton lines={6} className="min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const days = query.data?.days ?? [];
  const labels = { production: t("production"), feedcost: t("feedcost") };

  return (
    <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px] lg:col-span-2">

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LEGEND.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="h-1.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              {labels[item.key as keyof typeof labels]}
            </div>
          ))}
        </div>
        <ProductionVsFeedcostChartInner days={days} labels={labels} />
      </div>
    </DashboardCard>
  );
}
