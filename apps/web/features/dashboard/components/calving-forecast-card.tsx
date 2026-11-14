"use client"; // live query

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@rakhal/ui/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { useCattleDetailModal } from "@/features/cattle/context/cattle-detail-modal-context";
import { useCalvingForecast } from "../hooks/use-dashboard-widgets";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";
import { DashboardCard } from "./dashboard-card";

export function CalvingForecastCard() {
  const t = useTranslations("dashboard.calvingForecast");
  const { openCattleDetail } = useCattleDetailModal();
  const query = useCalvingForecast();

  if (query.isLoading) return <CardSkeleton lines={3} className="h-full min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={t("title")} className="min-h-[360px]">
      {!query.data?.forecast.length ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-1 flex-col gap-2">
          {query.data.forecast.map((item) => (
            <li key={item.cattleId}>
              <div className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted">
                <button
                  type="button"
                  onClick={() => openCattleDetail(item.cattleId)}
                  className="min-w-0 truncate text-left text-foreground hover:underline focus-visible:outline-none"
                >
                  <TruncatedText className="inline-block max-w-full align-bottom font-medium">{item.name || item.tag}</TruncatedText>
                  {item.shed ? <span className="ml-1.5 text-xs text-muted-foreground">· {item.shed}</span> : null}
                </button>
                <Badge variant={item.daysRemaining != null && item.daysRemaining <= 3 ? "warning" : "outline"}>
                  {t("daysRemaining", { days: item.daysRemaining ?? "—" })}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
