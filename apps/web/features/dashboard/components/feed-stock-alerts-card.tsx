"use client"; // live query

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pill, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { TruncatedText } from "@/components/shared/truncated-text";
import { useFeedStockAlerts } from "../hooks/use-dashboard-widgets";
import type { FeedStockAlertItem } from "../types";
import { DashboardCard } from "./dashboard-card";

const MAX_ROWS = 6;

/** One alert: type icon, name, stock-vs-threshold bar (red = critical, amber = low) and days left. */
function AlertRow({ alert }: { alert: FeedStockAlertItem }) {
  const t = useTranslations("dashboard.feedStockAlerts");
  const critical = alert.status === "critical";
  const pct = alert.threshold > 0 ? Math.min(100, Math.max(4, (alert.currentStock / alert.threshold) * 100)) : 4;
  const Icon = alert.itemType === "medicine" ? Pill : Wheat;
  return (
    <li>
      <Link
        href={alert.itemType === "medicine" ? `/inventory/medicines/${alert.itemId}` : `/inventory?tab=feed&segment=purchased`}
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            critical ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <TruncatedText className="text-sm font-medium text-foreground">{alert.name}</TruncatedText>
            <span className="shrink-0 text-sm tabular-nums text-foreground">
              {alert.currentStock}
              <span className="text-xs text-muted-foreground"> {alert.unit}</span>
            </span>
          </span>
          <span
            role="progressbar"
            aria-label={alert.name}
            aria-valuemin={0}
            aria-valuemax={alert.threshold}
            aria-valuenow={alert.currentStock}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <span className={cn("block h-full rounded-full", critical ? "bg-destructive" : "bg-warning")} style={{ width: `${pct}%` }} />
          </span>
          <span className="flex items-center justify-between gap-2 text-xs">
            <span className={cn("font-medium", critical ? "text-destructive" : "text-warning")}>{t(`status.${alert.status}`)}</span>
            {alert.daysRemainingEstimate != null ? (
              <span className="text-muted-foreground">{t("daysLeft", { count: Math.max(0, Math.round(alert.daysRemainingEstimate)) })}</span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function FeedStockAlertsCard() {
  const t = useTranslations("dashboard.feedStockAlerts");
  const query = useFeedStockAlerts();

  const headerRight = (
    <Link href="/inventory" className="text-xs font-medium text-primary-hover hover:underline">
      {t("viewInventory")}
    </Link>
  );

  if (query.isLoading) return <CardSkeleton lines={3} className="h-full min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }

  // Critical first, then lowest stock-to-threshold ratio.
  const alerts = [...(query.data?.alerts ?? [])].sort((a, b) => {
    if (a.status !== b.status) return a.status === "critical" ? -1 : 1;
    const ra = a.threshold > 0 ? a.currentStock / a.threshold : 0;
    const rb = b.threshold > 0 ? b.currentStock / b.threshold : 0;
    return ra - rb;
  });

  return (
    <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
      {alerts.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {alerts.slice(0, MAX_ROWS).map((alert) => (
            <AlertRow key={alert.itemId} alert={alert} />
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
