"use client"; // owns the window selection; live query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { useHealthOutcomes } from "../hooks/use-health";
import type { HealthCondition } from "../types";
import { HealthCard } from "./health-card";

const WINDOWS = [30, 90, 365] as const;

function Kpi({ label, value, caption }: { label: string; value: React.ReactNode; caption?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

const DASH = <span className="text-muted-foreground">—</span>;

/** RFE-138 (EPIC_HEALTH_CENTER D6) — "what was the sickness, what did we do, what was the result" for the whole
 * herd: cases opened in the window, recovery rate, average days to recover, average cost, recurrence, and the same
 * per condition. Every figure is server-derived (`GET /health/outcomes`, RAKHAL-467); a rate is "—" until there is
 * something to divide by, never a fake 0 %. */
export function HealthOutcomesCard() {
  const t = useTranslations("health.outcomes");
  const tCondition = useTranslations("health.reportSickness");
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(90);
  const query = useHealthOutcomes(days);

  const windowPicker = (
    <div role="radiogroup" aria-label={t("window")} className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
      {WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={days === w}
          onClick={() => setDays(w)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            days === w ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`windowOption.${w}`)}
        </button>
      ))}
    </div>
  );

  if (query.isLoading) return <CardSkeleton lines={5} className="rounded-2xl" />;
  if (query.isError || !query.data) {
    return (
      <HealthCard title={t("title")} headerRight={windowPicker}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </HealthCard>
    );
  }

  const data = query.data;
  const pct = (n: number | null) => (n === null ? DASH : `${n}%`);

  return (
    <HealthCard title={t("title")} headerRight={windowPicker}>
      {data.cases === 0 ? (
        <EmptyState title={t("emptyTitle", { days })} description={t("emptyDescription")} className="py-8" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label={t("cases")} value={data.cases} caption={t("openCount", { count: data.openCases })} />
            <Kpi label={t("recoveryRate")} value={pct(data.recoveryRate)} caption={t("recoveredOf", { recovered: data.recovered, deaths: data.mortality })} />
            <Kpi label={t("avgDays")} value={data.avgDaysToRecover === null ? DASH : t("daysValue", { count: data.avgDaysToRecover })} />
            <Kpi label={t("avgCost")} value={data.avgCost === null ? DASH : <MoneyText amount={data.avgCost} />} caption={t("avgCostHint")} />
            <Kpi label={t("recurrence")} value={pct(data.recurrenceRate)} caption={t("recurrenceHint")} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">{t("byCondition")}</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("condition")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("cases")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("recoveryRate")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("avgDays")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("avgCost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCondition.slice(0, 8).map((row) => (
                    <tr key={row.condition ?? "none"} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">
                        {row.condition ? tCondition(`conditionValue.${row.condition as HealthCondition}`) : t("noCondition")}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">{row.cases}</td>
                      <td className="px-3 py-2 text-right text-foreground">{pct(row.recoveryRate)}</td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {row.avgDaysToRecover === null ? DASH : t("daysValue", { count: row.avgDaysToRecover })}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">{row.avgCost === null ? DASH : <MoneyText amount={row.avgCost} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.otherClosed > 0 ? <p className="text-xs text-muted-foreground">{t("otherClosedNote", { count: data.otherClosed })}</p> : null}
          </div>
        </>
      )}
    </HealthCard>
  );
}
