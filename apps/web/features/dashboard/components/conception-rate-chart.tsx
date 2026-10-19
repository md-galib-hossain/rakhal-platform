"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useConceptionRate } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";

const ConceptionRateChartInner = dynamic(() => import("./conception-rate-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

/** Figma-exact colors (node 732:2250) — kept in sync with `conception-rate-chart-inner.tsx`. */
const LEGEND = [
  { key: "monthlyConception", color: "var(--chart-production)" },
  { key: "avgRate", color: "var(--chart-feedcost)" },
] as const;

/** Matches the Figma "Conception Rate (45%)" card: 12 months of confirmed-pregnancy bars with an
 * average-rate line, backed by the real `GET /dashboard/conception-rate` route (`BreedingEvent`
 * counts per month — see `dashboard.service.ts#conceptionRate`). */
export function ConceptionRateChart() {
  const t = useTranslations("dashboard.conceptionRate");
  const query = useConceptionRate();

  if (query.isLoading) return <CardSkeleton lines={6} className="rounded-2xl" />;
  const months = query.data?.months ?? [];
  const totalInseminations = months.reduce((sum, m) => sum + m.inseminations, 0);
  const totalConfirmed = months.reduce((sum, m) => sum + m.confirmedPregnancies, 0);
  const overallRate = totalInseminations ? Math.round((totalConfirmed / totalInseminations) * 1000) / 10 : 0;
  const title = t("title", { rate: overallRate });

  if (query.isError) {
    return (
      <DashboardCard title={title}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const labels = { monthlyConception: t("monthlyConception"), avgRate: t("avgRate") };

  return (
    <DashboardCard title={title}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LEGEND.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="h-1.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              {labels[item.key as keyof typeof labels]}
            </div>
          ))}
        </div>
        <ConceptionRateChartInner months={months} labels={labels} />
      </div>
    </DashboardCard>
  );
}
