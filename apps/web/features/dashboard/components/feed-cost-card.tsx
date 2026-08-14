"use client"; // live query

import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useFeedCostSummary } from "@/features/feed/hooks/use-feed";
import { DashboardCard } from "./dashboard-card";

/**
 * "Feed Cost" dashboard widget (2026-08-13, user request — "Feed cost/cow, cost/litre... on main
 * Dashboard"). Reuses `useFeedCostSummary` (feed module's own hook, `GET /feed/cost-summary`)
 * directly rather than adding a parallel `dashboard.api.ts` wrapper — this widget is the only
 * consumer, and the feed hook already has the exact shape needed. A day-by-day raw chart already
 * exists (`ProductionVsFeedcostChart`); this tile surfaces the per-unit metrics the user actually
 * asked for (cost/cow/day, cost/litre) that chart doesn't.
 */
export function FeedCostCard() {
  const t = useTranslations("dashboard.feedCost");
  const query = useFeedCostSummary(7);

  if (query.isLoading) return <CardSkeleton lines={3} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }

  const data = query.data;

  return (
    <DashboardCard title={t("title")}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
          <span className="text-xs text-muted-foreground">{t("costPerCowDay")}</span>
          <p className="text-lg font-semibold text-foreground">
            {data?.cost_per_cow_per_day != null ? t("currencyValue", { value: data.cost_per_cow_per_day.toFixed(2) }) : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
          <span className="text-xs text-muted-foreground">{t("costPerLitre")}</span>
          <p className="text-lg font-semibold text-foreground">
            {data?.cost_per_litre != null ? t("currencyValue", { value: data.cost_per_litre.toFixed(2) }) : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
          <span className="text-xs text-muted-foreground">{t("totalCost7d")}</span>
          <p className="text-lg font-semibold text-foreground">{t("currencyValue", { value: (data?.total_cost ?? 0).toFixed(2) })}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
          <span className="text-xs text-muted-foreground">{t("headcount")}</span>
          <p className="text-lg font-semibold text-foreground">{data?.headcount ?? 0}</p>
        </div>
      </div>
    </DashboardCard>
  );
}
