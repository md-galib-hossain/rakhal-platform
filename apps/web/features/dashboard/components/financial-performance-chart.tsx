"use client"; // live query + dynamic chart import

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { useFinancialPerformance } from "../hooks/use-dashboard-widgets";
import { DashboardCard, PeriodPill } from "./dashboard-card";

const loadFinancialPerformanceChart = () => import("./financial-performance-chart-inner");
const FinancialPerformanceChartInner = dynamic(loadFinancialPerformanceChart, {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

/** Figma-exact colors (node 732:1864) — kept in sync with `financial-performance-chart-inner.tsx`. */
const LEGEND = [
  { key: "income", color: "var(--chart-income)" },
  { key: "expense", color: "var(--chart-expense)" },
  { key: "profit", color: "var(--chart-profit)" },
] as const;

/** Matches the Figma "Financial Performance Over Time" card: a 12-month Income/Expense/Profit
 * line trend, backed by the real `GET /dashboard/financial-performance` route (12 monthly
 * `FinanceTransaction` sums — see `dashboard.service.ts#financialPerformance`).
 *
 * RAKHAL-360 note: this route's month buckets now additively also sum `JournalEntry` rows against
 * REVENUE/EXPENSE `LedgerAccount`s (Finance V2 activity, RAKHAL-351) on top of the pre-existing V1
 * `FinanceTransaction` sums — confirmed by reading `dashboard.service.ts#financialPerformance`
 * directly. No frontend change needed; this component already renders whatever `months[]` the
 * backend returns. */
export function FinancialPerformanceChart() {
  const t = useTranslations("dashboard.financialPerformance");
  const query = useFinancialPerformance();

  const headerRight = <PeriodPill label={t("periodLabel")} />;

  useEffect(() => {
    void loadFinancialPerformanceChart();
  }, []);

  if (query.isLoading) return <CardSkeleton lines={6} className="min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const months = query.data?.months ?? [];
  const labels = { income: t("income"), expense: t("expense"), profit: t("profit") };

  return (
    <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px] lg:col-span-2">

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LEGEND.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="h-1.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              {labels[item.key]}
            </div>
          ))}
        </div>
        <FinancialPerformanceChartInner months={months} labels={labels} />
      </div>
    </DashboardCard>
  );
}
