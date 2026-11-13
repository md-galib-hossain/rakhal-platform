"use client"; // live query

import { useTranslations } from "next-intl";
import { Activity, Baby, CalendarClock, HeartPulse } from "lucide-react";
import { Card } from "@rakhal/ui/ui/card";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { useReproductionDashboard } from "../hooks/use-reproduction";

interface HighlightTileProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  footnote?: React.ReactNode;
}

function HighlightTile({ icon, iconBg, label, value, footnote }: HighlightTileProps) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg shadow-2xs", iconBg)}>
          {icon}
        </span>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
      </div>
    </div>
  );
}

/**
 * Reproduction Highlights KPI Section (Figma/Rakhal Design Standard).
 * Follows the exact pattern from `CattleHighlightsBar` and `HealthStatStrip`:
 * An elevated outer card with an explicit section title (`text-xl font-medium`)
 * and a 4-tile grid of consistent, beautifully proportioned KPI tiles.
 */
export function ReproductionKpiCards() {
  const t = useTranslations("reproduction.kpi");
  const dashboard = useReproductionDashboard();

  const kpis = dashboard.data?.kpis;
  const pct = (v: number | null | undefined) => (v != null ? `${v}%` : "—");
  const days = (v: number | null | undefined) => (v != null ? t("daysValue", { value: v }) : "—");

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border-border p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
      </div>

      {dashboard.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-xl" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />
      ) : dashboard.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
