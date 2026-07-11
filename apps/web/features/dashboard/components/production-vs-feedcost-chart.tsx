"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductionVsFeedcost } from "../hooks/use-dashboard-widgets";
import { DashboardCard, PeriodPill } from "./dashboard-card";

const ProductionVsFeedcostChartInner = dynamic(() => import("./production-vs-feedcost-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

/** Figma-exact colors (node 732:2017) — kept in sync with `production-vs-feedcost-chart-inner.tsx`. */
const LEGEND = [
  { key: "production", color: "#059669" },
  { key: "feedcost", color: "#ffbf54" },
] as const;

/** Matches the Figma "Production vs Feedcost" card: current-month daily milk yield vs feed
 * distribution cost, backed by the real `GET /dashboard/production-vs-feedcost` route (`MilkLogEntry`
 * + `FeedDistribution` sums per day — see `dashboard.service.ts#productionVsFeedcost`). */
export function ProductionVsFeedcostChart() {
  const t = useTranslations("dashboard.productionVsFeedcost");
  const query = useProductionVsFeedcost();

  const headerRight = <PeriodPill label={t("periodLabel")} />;

  if (query.isLoading) return <CardSkeleton lines={6} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const days = query.data?.days ?? [];
  const labels = { production: t("production"), feedcost: t("feedcost") };

  return (
    <DashboardCard title={t("title")} headerRight={headerRight} className="lg:col-span-2">
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
