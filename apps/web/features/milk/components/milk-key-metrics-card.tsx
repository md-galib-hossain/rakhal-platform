"use client"; // live query

import { useLocale, useTranslations } from "next-intl";
import { Package, ShieldCheck, Users, Coins } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useMilkLogTable, useMilkOverview } from "../hooks/use-milk";
import { MilkCard } from "./milk-card";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "Production Key Metrics" — 2x2 KPI grid (Figma node 734:32330). Today's yield/vs-yesterday and
 * withholding volume come from the real `GET /milk/overview` — the same (dateless, defaults to
 * "today" server-side) query `MilkTrendChart` uses, so TanStack Query dedupes the two calls into
 * one request. "Avg. Per Cow (7D)" is computed from today's `GET /milk/log` rows' `avgYield7d`
 * (a second, separate request from whatever date the Milk Log section below happens to be browsing
 * — this KPI is always about today). Market value stays "—": `costPerLitreToday`/`marketValueToday`
 * are always `null` on the real backend (Finance/Settings wiring not built yet) — shown honestly
 * rather than a fake ৳0/12,000 (Figma has a static mock value here). */
export function MilkKeyMetricsCard() {
  const t = useTranslations("milk.kpi");
  const locale = useLocale() as Locale;
  const overview = useMilkOverview();
  const logTable = useMilkLogTable(todayIso());

  if (overview.isLoading || logTable.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (overview.isError) {
    return (
      <MilkCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => overview.refetch()} />
      </MilkCard>
    );
  }

  const data = overview.data;
  const num = (v: number) => formatNumber(v, locale, { maximumFractionDigits: 1 });

  const todayL = data?.today.totalL ?? 0;
  const yesterdayL = data?.yesterday.totalL ?? 0;
  const vsYesterdayPct = yesterdayL > 0 ? Math.round(((todayL - yesterdayL) / yesterdayL) * 1000) / 10 : undefined;

  const avgYields = (logTable.data?.entries ?? []).map((r) => r.avgYield7d).filter((v): v is number => v != null);
  const avgPerCow = avgYields.length > 0 ? avgYields.reduce((sum, v) => sum + v, 0) / avgYields.length : null;

  return (
    <MilkCard title={t("title")}>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label={t("todayYield")}
          value={`${num(todayL)}L`}
          icon={<Package className="size-4" aria-hidden />}
          iconClassName="bg-success-tint text-success"
          delta={vsYesterdayPct}
          deltaLabel={`% ${t("vsYesterday")}`}
        />
        <StatCard
          label={t("avgPerCow")}
          value={avgPerCow != null ? `${num(avgPerCow)}L` : t("notAvailable")}
          icon={<Users className="size-4" aria-hidden />}
          iconClassName="bg-info-tint text-info"
          sparkline={<p className="text-xs text-muted-foreground">{t("acrossCows", { count: avgYields.length })}</p>}
        />
        <StatCard
          label={t("safetyStatus")}
          value={`${num(data?.today.withholdingL ?? 0)}L`}
          icon={<ShieldCheck className="size-4" aria-hidden />}
          iconClassName="bg-warning-tint text-warning"
          sparkline={<p className="text-xs text-muted-foreground">{t("safetyCaption")}</p>}
        />
        <StatCard
          label={t("marketValue")}
          value={data?.marketValueToday != null ? `৳${num(data.marketValueToday)}` : t("notAvailable")}
          icon={<Coins className="size-4" aria-hidden />}
          iconClassName="bg-accent-indigo-tint text-accent-indigo"
          sparkline={<p className="text-xs text-muted-foreground">{t("marketValueCaption")}</p>}
        />
      </div>
    </MilkCard>
  );
}
