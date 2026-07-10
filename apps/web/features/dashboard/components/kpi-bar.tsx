"use client"; // live query

import { useLocale, useTranslations } from "next-intl";
import { DollarSign, Droplets, HeartPulse, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useKpis } from "../hooks/use-dashboard-widgets";

export function KpiBar() {
  const t = useTranslations("dashboard.kpis");
  const locale = useLocale() as Locale;
  const query = useKpis();

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={1} />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        icon={<DollarSign className="size-4" aria-hidden />}
        label={t("costPerLitre")}
        value={formatMoney(data.costPerLitre.value, locale)}
      />
      <StatCard
        icon={<Droplets className="size-4" aria-hidden />}
        label={t("todaysYield")}
        value={`${data.todaysYield.value} ${data.todaysYield.unit}`}
        delta={data.todaysYield.changePct ?? undefined}
        deltaLabel={t("vsYesterday")}
      />
      <StatCard
        icon={<HeartPulse className="size-4" aria-hidden />}
        label={t("herdHealth")}
        value={`${data.herdHealth.value}${data.herdHealth.unit}`}
        deltaLabel={t("sickCount", { count: data.herdHealth.sickCount })}
      />
      <StatCard
        icon={<Wallet className="size-4" aria-hidden />}
        label={t("cashRunway")}
        value={t("daysValue", { days: data.cashRunway.value })}
        deltaLabel={data.cashRunway.status !== "healthy" ? t(`status.${data.cashRunway.status}`) : undefined}
      />
    </div>
  );
}
