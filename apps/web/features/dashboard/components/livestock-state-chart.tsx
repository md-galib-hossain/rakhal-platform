"use client"; // period tabs (local UI state) + live query + dynamic chart import

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useLivestockState } from "../hooks/use-dashboard-widgets";
import type { DashboardPeriod } from "../types";

const LivestockStateChartInner = dynamic(() => import("./livestock-state-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

export function LivestockStateChart() {
  const t = useTranslations("dashboard.livestockState");
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const query = useLivestockState(period);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t("title")}</CardTitle>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
          <TabsList>
            <TabsTrigger value="today">{t("today")}</TabsTrigger>
            <TabsTrigger value="week">{t("week")}</TabsTrigger>
            <TabsTrigger value="month">{t("month")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : query.isError ? (
          <ErrorState description={t("error")} onRetry={() => query.refetch()} />
        ) : (
          <LivestockStateChartInner bars={query.data?.states ?? []} />
        )}
      </CardContent>
    </Card>
  );
}
