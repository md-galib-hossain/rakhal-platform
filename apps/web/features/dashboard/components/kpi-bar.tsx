"use client"; // live query

import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, DollarSign, Droplets, HeartPulse, Wallet } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { formatMoney, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/constants/i18n";
import { useKpis } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";

/** Small up/down delta badge next to a KPI value — currently only wired for Today's Yield
 * (the only KPI whose backend comparison, `changePct`/`changeDirection`, is populated). */
function KpiDeltaBadge({ pct, direction }: { pct: number; direction: "up" | "down" }) {
  const t = useTranslations("dashboard.kpis");
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-0.5 text-xs font-medium",
        direction === "up" ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {formatPct(pct)} {t("vsYesterday")}
    </span>
  );
}

/** One 2x2 tile — matches the Figma "Production Key Metrics" card's "KPI" component (732:1732):
 * colored icon badge, label, big bold value. Figma's mock doesn't show deltas, but Today's Yield
 * now renders one when the backend has a prior-day comparison (`delta` optional, other tiles
 * unaffected). */
function KpiTile({
  icon,
  iconBg,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  delta?: { pct: number; direction: "up" | "down" } | null;
}) {
  return (
    <div className="flex h-full flex-1 flex-col justify-between gap-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        {delta && <KpiDeltaBadge pct={delta.pct} direction={delta.direction} />}
      </div>
    </div>
  );
}

export function KpiBar() {
  const t = useTranslations("dashboard.kpis");
  const locale = useLocale() as Locale;
  const query = useKpis();

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <DashboardCard title={t("title")}>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <KpiTile
          icon={<Droplets className="size-4 text-success" aria-hidden />}
          iconBg="bg-success-tint"
          label={t("todaysYield")}
          value={`${data.todaysYield.value} ${data.todaysYield.unit}`}
          delta={
            data.todaysYield.value > 0 && data.todaysYield.changePct !== null && data.todaysYield.changeDirection !== null
              ? { pct: data.todaysYield.changePct, direction: data.todaysYield.changeDirection }
              : null
          }
        />
        <KpiTile
          icon={<HeartPulse className="size-4 text-info" aria-hidden />}
          iconBg="bg-info-tint"
          label={t("herdHealth")}
          value={`${data.herdHealth.value}${data.herdHealth.unit}`}
        />
        <KpiTile
          icon={<Wallet className="size-4 text-warning" aria-hidden />}
          iconBg="bg-warning-tint"
          label={t("cashRunway")}
          value={t("daysValue", { days: data.cashRunway.value })}
        />
        <KpiTile
          icon={<DollarSign className="size-4 text-accent-indigo" aria-hidden />}
          iconBg="bg-accent-indigo-tint"
          label={t("costPerLitre")}
          value={formatMoney(data.costPerLitre.value, locale)}
        />
      </div>
    </DashboardCard>
  );
}
