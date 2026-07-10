"use client"; // tabs (local UI state) + live query + dynamic chart import

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHerdStatus } from "../hooks/use-dashboard-widgets";
import type { DonutSlice } from "./herd-status-chart-inner";

// Chart rendering is client/DOM-only and not needed for the initial paint — keep it out of the main bundle.
const HerdStatusChartInner = dynamic(() => import("./herd-status-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[180px] w-full" />,
});

function Legend({ slices }: { slices: DonutSlice[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {slices.map((slice) => (
        <li key={slice.name} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
            {slice.name}
          </span>
          <span className="font-medium text-foreground">{slice.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function HerdStatusDonut() {
  const t = useTranslations("dashboard.herdStatus");
  const query = useHerdStatus();

  if (query.isLoading) return <CardSkeleton lines={4} />;
  if (query.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState description={t("error")} onRetry={() => query.refetch()} />
        </CardContent>
      </Card>
    );
  }
  const data = query.data;
  if (!data) return null;

  const production: DonutSlice[] = [
    { name: t("production.milking"), value: data.productionBreakdown.milking, color: "var(--color-chart-1)" },
    { name: t("production.dry"), value: data.productionBreakdown.dry, color: "var(--color-chart-2)" },
    { name: t("production.fresh"), value: data.productionBreakdown.fresh, color: "var(--color-chart-3)" },
    { name: t("production.growing"), value: data.productionBreakdown.growing, color: "var(--color-chart-4)" },
  ];
  const reproductive: DonutSlice[] = [
    { name: t("reproductive.open"), value: data.reproductiveBreakdown.open, color: "var(--color-chart-1)" },
    { name: t("reproductive.inseminated"), value: data.reproductiveBreakdown.inseminated, color: "var(--color-chart-2)" },
    { name: t("reproductive.pregnant"), value: data.reproductiveBreakdown.pregnant, color: "var(--color-chart-3)" },
    { name: t("reproductive.dryPeriod"), value: data.reproductiveBreakdown.dryPeriod, color: "var(--color-chart-4)" },
  ];
  const health: DonutSlice[] = [
    { name: t("health.healthy"), value: data.healthBreakdown.healthy, color: "var(--color-success)" },
    { name: t("health.sick"), value: data.healthBreakdown.sick, color: "var(--color-destructive)" },
    { name: t("health.inTreatment"), value: data.healthBreakdown.inTreatment, color: "var(--color-warning)" },
    { name: t("health.withholding"), value: data.healthBreakdown.withholding, color: "var(--color-info)" },
  ];
  const calves: DonutSlice[] = [
    { name: t("calves.newborn"), value: data.calves.newborn_0_7, color: "var(--color-chart-1)" },
    { name: t("calves.young"), value: data.calves.young_7_60, color: "var(--color-chart-2)" },
    { name: t("calves.preWeaning"), value: data.calves.pre_weaning_60_90, color: "var(--color-chart-3)" },
    { name: t("calves.postWeaning"), value: data.calves.post_weaning_90plus, color: "var(--color-chart-4)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("title")} · {t("totalActive", { count: data.totalActive })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="production">
          <TabsList>
            <TabsTrigger value="production">{t("tabs.production")}</TabsTrigger>
            <TabsTrigger value="reproductive">{t("tabs.reproductive")}</TabsTrigger>
            <TabsTrigger value="health">{t("tabs.health")}</TabsTrigger>
            <TabsTrigger value="calves">{t("tabs.calves")}</TabsTrigger>
          </TabsList>
          <TabsContent value="production" className="grid grid-cols-2 items-center gap-4">
            <HerdStatusChartInner slices={production} />
            <Legend slices={production} />
          </TabsContent>
          <TabsContent value="reproductive" className="grid grid-cols-2 items-center gap-4">
            <HerdStatusChartInner slices={reproductive} />
            <Legend slices={reproductive} />
          </TabsContent>
          <TabsContent value="health" className="grid grid-cols-2 items-center gap-4">
            <HerdStatusChartInner slices={health} />
            <Legend slices={health} />
          </TabsContent>
          <TabsContent value="calves" className="grid grid-cols-2 items-center gap-4">
            <HerdStatusChartInner slices={calves} />
            <Legend slices={calves} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
