"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHerdStatus } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";
import type { DonutSlice } from "./herd-status-chart-inner";

// Chart rendering is client/DOM-only and not needed for the initial paint — keep it out of the main bundle.
const HerdStatusChartInner = dynamic(() => import("./herd-status-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto size-[170px] rounded-full" />,
});

/** Matches the Figma "Livestock Count" card (732:1737) exactly: one donut, "Total" center label,
 * a legend row below. Figma's mock legend is Cows/Heifers/Bulls/Weiners/Calves (a sex/age split
 * this backend doesn't track) — used the real `productionBreakdown` categories instead (the
 * closest real "what state is the herd in" split `herd-status.ts` actually returns). */
export function HerdStatusDonut() {
  const t = useTranslations("dashboard.herdStatus");
  const query = useHerdStatus();

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const data = query.data;
  if (!data) return null;

  const slices: DonutSlice[] = [
    { name: t("production.milking"), value: data.productionBreakdown.milking, color: "#065f46" },
    { name: t("production.dry"), value: data.productionBreakdown.dry, color: "#047857" },
    { name: t("production.fresh"), value: data.productionBreakdown.fresh, color: "#10b981" },
    { name: t("production.growing"), value: data.productionBreakdown.growing, color: "#6ee7b7" },
    { name: t("calvesTotal"), value: data.calves.total, color: "#d1fae5" },
  ];

  return (
    <DashboardCard title={t("title")}>
      <div className="flex flex-1 flex-col items-center justify-between gap-6">
        <HerdStatusChartInner slices={slices} centerLabel={t("totalLabel")} centerValue={data.totalActive} />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {slices.map((slice) => (
            <div key={slice.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="h-1.5 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.name}: <span className="font-medium text-foreground">{slice.value}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
