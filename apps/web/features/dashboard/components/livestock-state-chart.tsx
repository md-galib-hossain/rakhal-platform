"use client"; // period select (local UI state) + live query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useLivestockState } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";
import { PeriodSelect } from "./period-select";
import type { DashboardPeriod } from "../types";

/** Figma-exact colors per state (732:1788) — overrides the backend's own arbitrary per-state hex
 * (kept for other consumers) so this widget matches the "Livestock State" card pixel-for-pixel;
 * keyed by the real `state` string the API returns. */
const STATE_STYLE: Record<string, { bar: string; tint: string; text: string }> = {
  fresh: { bar: "var(--state-fresh-bar)", tint: "var(--state-fresh-tint)", text: "var(--state-fresh-text)" },
  insemination: { bar: "var(--state-insemination-bar)", tint: "var(--state-insemination-tint)", text: "var(--state-insemination-text)" },
  dry: { bar: "var(--state-dry-bar)", tint: "var(--state-dry-tint)", text: "var(--state-dry-text)" },
  milking: { bar: "var(--state-milking-bar)", tint: "var(--state-milking-tint)", text: "var(--state-milking-text)" },
  pregnant: { bar: "var(--state-pregnant-bar)", tint: "var(--state-pregnant-tint)", text: "var(--state-pregnant-text)" },
  sick: { bar: "var(--state-sick-bar)", tint: "var(--state-sick-tint)", text: "var(--state-sick-text)" },
};
const ORDER = ["fresh", "insemination", "dry", "milking", "pregnant", "sick"];

export function LivestockStateChart() {
  const t = useTranslations("dashboard.livestockState");
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const query = useLivestockState(period);

  const headerRight = <PeriodSelect value={period} onChange={setPeriod} />;

  if (query.isLoading) return <CardSkeleton lines={6} className="min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const states = query.data?.states ?? [];
  const byState = new Map(states.map((s) => [s.state, s.count]));
  const scaleMax = Math.max(100, ...states.map((s) => s.count));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(scaleMax * f));

  return (
    <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">

      <div className="flex h-full flex-col justify-between gap-3 py-1">
        {ORDER.map((state) => {
          const count = byState.get(state) ?? 0;
          const style = STATE_STYLE[state];
          const pct = Math.min(100, (count / scaleMax) * 100);
          return (
            <div key={state} className="flex items-center gap-2">
              <p className="w-[72px] shrink-0 text-xs font-medium text-muted-foreground">{t(`states.${state}`)}</p>
              <div className="relative h-6 flex-1 rounded-md" style={{ backgroundColor: style.tint }}>
                <div
                  className="h-6 rounded-md transition-[width]"
                  style={{ width: `${pct}%`, backgroundColor: style.bar }}
                />
                {/* Figma (732:1788) pins the value pill near the track's right edge for every
                 * row, regardless of the bar's own fill length — not at the end of the fill. */}
                <span
                  className="absolute right-[5px] top-1/2 flex h-4 min-w-[22px] -translate-y-1/2 items-center justify-center rounded-[4px] px-[3px] text-xs font-bold shadow-[0px_1px_2px_rgba(0,0,0,0.15)]"
                  style={{ color: style.text, backgroundColor: style.tint }}
                >
                  {count}
                </span>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <p className="w-[72px] shrink-0 text-xs text-muted-foreground">{t("axisLabel")}</p>
          <div className="flex flex-1 justify-between text-xs text-muted-foreground">
            {ticks.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
