"use client"; // period tabs (local UI state) + live query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useProductionSummary } from "../hooks/use-dashboard-widgets";
import type { DashboardPeriod } from "../types";

export function ProductionSummaryCard() {
  const t = useTranslations("dashboard.productionSummary");
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const query = useProductionSummary(period);

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
          <CardSkeleton lines={3} className="border-none shadow-none" />
        ) : query.isError ? (
          <ErrorState description={t("error")} onRetry={() => query.refetch()} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold text-foreground">{query.data?.totalYieldL ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("totalYield")}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-success">{query.data?.sellableL ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("sellable")}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-warning">{query.data?.withholdingL ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("withholding")}</p>
              </div>
            </div>
            {query.data?.sessions ? (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                {Object.entries(query.data.sessions).map(([session, status]) => (
                  <div key={session} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{session}</span>
                    <span className="font-medium text-foreground">{t(`sessionStatus.${status}`)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
