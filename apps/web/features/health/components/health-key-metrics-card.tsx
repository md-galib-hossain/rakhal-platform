"use client"; // live query

import { useLocale, useTranslations } from "next-intl";
import { HeartPulse, ShieldAlert, Stethoscope, Wallet } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useHealthDashboard } from "../hooks/use-health";
import { ProgressRing } from "./progress-ring";
import { HealthCard } from "./health-card";

function KpiTile({
  icon,
  iconBg,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-1 flex-col justify-between gap-2 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-1">
        {value}
        {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
      </div>
    </div>
  );
}

/** Figma "Key Metrics" card (node 734:35663) — 4 KPI tiles. Figma's mock shows a "vs last
 * week/month" trend chip on Sick Bay/Medicine Expense, but the backend has no historical comparison
 * for either (`health.service.ts#getHealthDashboard` returns a flat current count, and
 * `medicineExpense` is a hard-coded `0` — not implemented server-side yet); both are shown as plain
 * current values instead of a fabricated delta. */
export function HealthKeyMetricsCard() {
  const t = useTranslations("health.kpis");
  const locale = useLocale() as Locale;
  const query = useHealthDashboard();

  if (query.isLoading) return <CardSkeleton lines={5} className="h-full rounded-2xl" />;
  if (query.isError) {
    return (
      <HealthCard title={t("title")} className="h-full">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </HealthCard>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <HealthCard title={t("title")} className="h-full w-[420px] shrink-0">
      <div className="grid flex-1 grid-cols-2 gap-2">
        <KpiTile
          icon={<HeartPulse className="size-4 text-primary" aria-hidden />}
          iconBg="bg-success-tint"
          label={t("herdHealthScore")}
          value={
            <div className="flex items-center gap-2.5">
              <p className="text-2xl font-bold text-foreground">{data.herdHealthScore}%</p>
              <ProgressRing value={data.herdHealthScore} size={30} strokeWidth={4} />
            </div>
          }
          caption={t("animalsHealthy", { healthy: data.healthyAnimalCount, total: data.totalAnimalCount })}
        />
        <KpiTile
          icon={<Stethoscope className="size-4 text-info" aria-hidden />}
          iconBg="bg-info-tint"
          label={t("sickBay")}
          value={<p className="text-2xl font-bold text-foreground">{data.sickBayCount}</p>}
        />
        <KpiTile
          icon={<Wallet className="size-4 text-warning" aria-hidden />}
          iconBg="bg-warning-tint"
          label={t("medicineExpense")}
          value={<p className="text-2xl font-bold text-foreground">{formatMoney(data.medicineExpense, locale)}</p>}
        />
        <KpiTile
          icon={<ShieldAlert className="size-4 text-accent-indigo" aria-hidden />}
          iconBg="bg-accent-indigo-tint"
          label={t("safetyStop")}
          value={<p className="text-2xl font-bold text-foreground">{data.safetyWithdrawalCount}</p>}
          caption={t("activeWithholding")}
        />
      </div>
    </HealthCard>
  );
}
