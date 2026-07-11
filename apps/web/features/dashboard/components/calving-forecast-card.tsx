"use client"; // live query

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useCalvingForecast } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";

export function CalvingForecastCard() {
  const t = useTranslations("dashboard.calvingForecast");
  const query = useCalvingForecast();

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
      {!query.data?.forecast.length ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-1 flex-col gap-2">
          {query.data.forecast.map((item) => (
            <li key={item.cattleId}>
              <Link
                href={`/reproduction/calving/${item.cattleId}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate text-foreground">
                  {item.name || item.tag}
                  {item.shed ? <span className="ml-1.5 text-xs text-muted-foreground">· {item.shed}</span> : null}
                </span>
                <Badge variant={item.daysRemaining != null && item.daysRemaining <= 3 ? "warning" : "outline"}>
                  {t("daysRemaining", { days: item.daysRemaining ?? "—" })}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
