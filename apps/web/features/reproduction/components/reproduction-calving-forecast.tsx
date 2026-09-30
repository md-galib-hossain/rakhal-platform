"use client"; // live query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck } from "lucide-react";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useReproductionDashboard } from "../hooks/use-reproduction";
import { ReproductionCard } from "./reproduction-card";
import { ReproductionCowIdentity } from "./reproduction-cow-identity";

/** 8 rows per page: this card shares a row with the (taller) events feed, so a bigger page than the
 * attention list's 5 keeps the pair balanced instead of leaving half the card empty. */
const FORECAST_PAGE_SIZE = 8;

/** Whole calendar days from today to `iso` (negative = overdue). Compares `YYYY-MM-DD` parts, not
 * instants, so the time-of-day / timezone of the stored date can never shift a row by one day. */
function daysUntil(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const now = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

/** "Calving Forecast Widget" (PRD §9.2): 30-day forward list of expected calvings, already sorted by
 * the backend. No calendar-grid component exists in `components/shared/` and this module has no Figma
 * frame to dictate one, so each row is a date tile + cow + "in N days" — the tile is tinted by how
 * close the date is, so the imminent ones read at a glance without a real calendar widget. */
export function ReproductionCalvingForecast() {
  const t = useTranslations("reproduction.calvingForecast");
  const dashboard = useReproductionDashboard();

  const [page, setPage] = useState(1);
  const rows = dashboard.data?.calving_forecast_30_days ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / FORECAST_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * FORECAST_PAGE_SIZE, safePage * FORECAST_PAGE_SIZE);

  return (
    <ReproductionCard
      title={t("title")}
      description={dashboard.data ? t("count", { count: rows.length }) : undefined}
      className="h-full"
    >
      {dashboard.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t("empty")} className="flex-1 justify-center py-8" />
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <ul className="flex flex-col divide-y divide-border">
            {pageRows.map((row) => {
              const days = daysUntil(row.expected_date);
              const soon = days <= 7;
              return (
                <li key={row.cattle_id} className="flex min-h-[3.75rem] items-center gap-3 py-2.5">
                  <time
                    dateTime={row.expected_date}
                    className={cn(
                      "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
                      soon ? "bg-warning-tint text-warning" : "bg-info-tint text-info",
                    )}
                  >
                    <DateText date={row.expected_date} options={{ day: "numeric" }} className="text-base font-bold" />
                    <DateText
                      date={row.expected_date}
                      options={{ month: "short" }}
                      className="mt-0.5 text-[0.65rem] font-medium uppercase"
                    />
                  </time>
                  <ReproductionCowIdentity cattleId={row.cattle_id} name={row.name} tag={row.tag} className="flex-1" />
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      days < 0 ? "text-destructive" : soon ? "text-warning" : "text-muted-foreground",
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
          {totalPages > 1 ? (
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} className="mt-auto" />
          ) : null}
        </div>
      )}
    </ReproductionCard>
  );
}
