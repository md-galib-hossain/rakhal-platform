"use client"; // live query

import { useTranslations } from "next-intl";
import { Droplets, HeartPulse, Timer, Wallet } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { cn } from "@/lib/utils";
import { useFinanceHighlights } from "../hooks/use-finance";
import type { SurvivalRunwayStatus } from "../types";

const RUNWAY_RING_COLOR: Record<SurvivalRunwayStatus, string> = {
  healthy: "var(--color-success)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
  unknown: "var(--color-border)",
};

function KpiTile({
  icon,
  iconBg,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-2 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg shadow-xs", iconBg)}>{icon}</span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** Figma "My Highlights" card (node 1039:33845 etc., every Finance tab), shared by all 5 tabs.
 * Real gaps vs the mock — flagged, not fabricated (see `types.ts` doc comment): "Net Margin per
 * Liter"/"AQR: 92.5" → the real `costPerLitreThisMonth` (a cost, not a margin — no selling price is
 * tracked here, and finance has no AQR figure); "90% Liquid" subtitle on Herd Market Value → dropped
 * (no such split exists; the field itself is real but always ৳0 server-side, no valuation model
 * yet). */
export function FinanceHighlights() {
  const t = useTranslations("finance.highlights");
  const query = useFinanceHighlights();

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <KpiTile
          icon={<Wallet className="size-4 text-accent-indigo" aria-hidden />}
          iconBg="bg-accent-indigo-tint"
          label={t("availableLiquidity")}
          value={<MoneyText amount={data.availableLiquidity} />}
          subtitle={t("availableLiquiditySubtitle")}
        />
        <KpiTile
          icon={<Droplets className="size-4 text-accent-indigo" aria-hidden />}
          iconBg="bg-accent-indigo-tint"
          label={t("costPerLitre")}
          value={data.costPerLitreThisMonth != null ? <MoneyText amount={data.costPerLitreThisMonth} /> : "—"}
          subtitle={t("costPerLitreSubtitle")}
        />
        <KpiTile
          icon={<HeartPulse className="size-4 text-accent-indigo" aria-hidden />}
          iconBg="bg-accent-indigo-tint"
          label={t("herdMarketValue")}
          value={<MoneyText amount={data.herdMarketValue} />}
        />
        <KpiTile
          icon={<Timer className="size-4 text-info" aria-hidden />}
          iconBg="bg-info-tint"
          label={t("survivalRunway")}
          subtitle={t("survivalRunwaySubtitle")}
          value={
            <div className="flex items-center gap-2">
              <span>{data.survivalRunwayDays != null ? t("daysValue", { days: data.survivalRunwayDays }) : "—"}</span>
              {data.survivalRunwayDays != null ? (
                // Status-colored ring (healthy/warning/critical) — a local variant rather than
                // reusing `features/health/components/progress-ring.tsx#ProgressRing`, which is
                // hardcoded to `--color-primary` and not meant to be edited for one KPI tile here.
                <span
                  role="img"
                  aria-label={t("runwayStatus", { status: data.survivalRunwayStatus })}
                  className="relative inline-block size-8 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(${RUNWAY_RING_COLOR[data.survivalRunwayStatus]} ${Math.min(100, data.survivalRunwayDays) * 3.6}deg, var(--color-border) 0deg)`,
                  }}
                >
                  <span className="absolute inset-0 m-auto size-6 rounded-full bg-card" />
                </span>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  );
}
