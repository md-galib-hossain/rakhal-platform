"use client"; // live query

import { useTranslations } from "next-intl";
import { Activity, Baby, CalendarClock, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { useReproductionDashboard } from "../hooks/use-reproduction";

function HighlightTile({
  icon,
  iconBg,
  label,
  value,
  footnote,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", iconBg)}>{icon}</span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
      </div>
    </div>
  );
}

/**
 * Reproduction Highlights KPI section (matching Animal Highlights visual language) —
 * 4 headline KPIs from `GET /reproduction/dashboard`: Heat Detection Rate, Conception Rate,
 * Pregnancy Rate, and Avg. Calving Interval.
 */
export function ReproductionKpiCards() {
  const t = useTranslations("reproduction.kpi");
  const dashboard = useReproductionDashboard();

  const kpis = dashboard.data?.kpis;
  const pct = (v: number | null | undefined) => (v != null ? `${v}%` : "—");
  const days = (v: number | null | undefined) => (v != null ? t("daysValue", { value: v }) : "—");

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border-border p-4 shadow-card">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

      {dashboard.isLoading ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] flex-1 rounded-xl" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />
      ) : dashboard.data ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <HighlightTile
            icon={<HeartPulse className="size-4 text-accent-pink" aria-hidden />}
            iconBg="bg-accent-pink-tint"
            label={t("heatDetectionRate")}
            value={pct(kpis?.heat_detection_rate_pct)}
          />
          <HighlightTile
            icon={<Activity className="size-4 text-success" aria-hidden />}
            iconBg="bg-success-tint"
            label={t("conceptionRate")}
            value={pct(kpis?.conception_rate_pct)}
          />
          <HighlightTile
            icon={<Baby className="size-4 text-info" aria-hidden />}
            iconBg="bg-info-tint"
            label={t("pregnancyRate")}
            value={pct(kpis?.pregnancy_rate_pct)}
          />
          <HighlightTile
            icon={<CalendarClock className="size-4 text-warning" aria-hidden />}
            iconBg="bg-warning-tint"
            label={t("avgCalvingInterval")}
            value={days(kpis?.avg_calving_interval_days)}
          />
        </div>
      ) : null}
    </Card>
  );
}
