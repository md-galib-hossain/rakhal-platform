"use client"; // live query

import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { useReproductionDashboard } from "../hooks/use-reproduction";
import { ReproductionCard } from "./reproduction-card";

/** "Calving Forecast Widget" (PRD §9.2): 30-day forward list of expected calvings. No calendar-grid
 * component exists in `components/shared/` and this module has no Figma frame to dictate one, so a
 * simple sorted list (already returned sorted by the backend) is used instead of building a new
 * shared calendar widget for one panel. */
export function ReproductionCalvingForecast() {
  const t = useTranslations("reproduction.calvingForecast");
  const dashboard = useReproductionDashboard();

  if (dashboard.isLoading) return <CardSkeleton lines={4} />;
  if (dashboard.isError) {
    return (
      <ReproductionCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />
      </ReproductionCard>
    );
  }

  const rows = dashboard.data?.calving_forecast_30_days ?? [];

  return (
    <ReproductionCard title={t("title")}>
      {rows.length === 0 ? (
        <EmptyState title={t("empty")} className="py-8" />
      ) : (
        <div className="flex flex-col">
          {rows.map((row) => (
            <div
              key={row.cattle_id}
              className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{row.name ?? row.tag}</span>
                {row.name ? <span className="text-xs text-muted-foreground">{row.tag}</span> : null}
              </div>
              <DateText date={row.expected_date} className="text-xs font-medium text-foreground" />
            </div>
          ))}
        </div>
      )}
    </ReproductionCard>
  );
}
