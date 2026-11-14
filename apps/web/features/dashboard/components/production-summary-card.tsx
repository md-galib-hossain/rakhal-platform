"use client"; // period select (local UI state) + live query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useProductionSummary } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";
import { PeriodSelect } from "./period-select";
import type { DashboardPeriod } from "../types";

export function ProductionSummaryCard() {
  const t = useTranslations("dashboard.productionSummary");
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const query = useProductionSummary(period);
  const headerRight = <PeriodSelect value={period} onChange={setPeriod} />;

  if (query.isLoading) return <CardSkeleton lines={3} className="h-full min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
      <div className="flex flex-1 flex-col justify-between gap-4">
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
    </DashboardCard>
  );
}
