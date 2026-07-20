"use client"; // live query

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useFeedStockAlerts } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";

export function FeedStockAlertsCard() {
  const t = useTranslations("dashboard.feedStockAlerts");
  const query = useFeedStockAlerts();

  if (query.isLoading) return <CardSkeleton lines={3} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={t("title")}>
      {!query.data?.alerts.length ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-1 flex-col gap-2">
          {query.data.alerts.map((alert) => (
            <li key={alert.itemId}>
              <Link
                href={alert.itemType === "medicine" ? `/inventory/medicines/${alert.itemId}` : `/inventory?tab=feed&segment=purchased`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate text-foreground">{alert.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {alert.currentStock} {alert.unit}
                  </span>
                  <Badge variant={alert.status === "critical" ? "destructive" : "warning"}>
                    {t(`status.${alert.status}`)}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
