"use client"; // live query

import { useTranslations } from "next-intl";
import { CalendarCheck } from "lucide-react";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useIncrementalReveal } from "@/lib/hooks/use-incremental-reveal";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { cn } from "@/lib/utils";
import { useReproductionDashboard } from "../hooks/use-reproduction";
import { ReproductionCard } from "./reproduction-card";
import { ReproductionCowIdentity } from "./reproduction-cow-identity";

const FORECAST_PAGE_SIZE = 8;

function daysUntil(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const now = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

/**
 * Calving Forecast Widget (30 Days).
 * Sits in the top 2-column operational row next to "Needs attention today".
 * Clean date badges, cow identity with avatar, and countdown chip.
 */
export function ReproductionCalvingForecast() {
  const t = useTranslations("reproduction.calvingForecast");
  const dashboard = useReproductionDashboard();

  const rows = dashboard.data?.calving_forecast_30_days ?? [];
  const reveal = useIncrementalReveal(rows, FORECAST_PAGE_SIZE);
  const pageRows = reveal.visible;

  return (
    <ReproductionCard
      title={t("title")}
      description={dashboard.data ? t("count", { count: rows.length }) : undefined}
      className="h-full min-h-[30rem]"
    >
      {dashboard.isLoading ? (
        <div className="flex flex-col gap-3 py-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t("empty")}
          className="flex-1 justify-center py-10"
        />
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <ul className="flex flex-col divide-y divide-border/80">
            {pageRows.map((row) => {
              const days = daysUntil(row.expected_date);
              const soon = days <= 7;
              return (
                <li
                  key={row.cattle_id}
                  className="flex min-h-[3.75rem] items-center gap-3.5 py-2.5 px-2 rounded-lg transition-colors hover:bg-muted/30"
                >
                  <time
                    dateTime={row.expected_date}
                    className={cn(
                      "flex size-10 shrink-0 flex-col items-center justify-center rounded-xl font-medium leading-none border shadow-2xs",
                      soon
                        ? "border-warning/30 bg-warning-tint text-warning"
                        : "border-info/30 bg-info-tint text-info",
                    )}
                  >
                    <DateText date={row.expected_date} options={{ day: "numeric" }} className="text-sm font-bold" />
                    <DateText
                      date={row.expected_date}
                      options={{ month: "short" }}
                      className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider"
                    />
                  </time>
                  <ReproductionCowIdentity cattleId={row.cattle_id} name={row.name} tag={row.tag} className="flex-1" />
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                      days < 0
                        ? "bg-destructive-tint text-destructive"
                        : soon
                          ? "bg-warning-tint text-warning"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {days < 0
                      ? t("overdue", { value: Math.abs(days) })
                      : days === 0
                        ? t("today")
                        : days === 1
                          ? t("tomorrow")
                          : t("inDays", { value: days })}
                  </span>
                </li>
              );
            })}
          </ul>
          <InfiniteScrollFooter
            hasNextPage={reveal.hasMore}
            isFetchingNextPage={false}
            onLoadMore={reveal.showMore}
            className="mt-auto"
          />
        </div>
      )}
    </ReproductionCard>
  );
}
