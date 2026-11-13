"use client"; // live query

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { useHealthOutcomes } from "../hooks/use-health";
import type { HealthCondition } from "../types";
import { HealthCard } from "./health-card";
import { ALL_TIME_OUTCOME_DAYS, rangeDays, type InsightsRange } from "./insights-range";

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
 * something to divide by, never a fake 0 %. The window is the Insights tab's shared range; "All time" asks for the
 * longest window the endpoint accepts. The by-condition list is the app's shared `Table` in a rounded card, the same
 * look as every other table. */
export function HealthOutcomesCard({ plain, range }: { plain?: boolean; range: InsightsRange }) {
  const t = useTranslations("health.outcomes");
  const tCondition = useTranslations("health.reportSickness");
  const days = rangeDays(range);
  const query = useHealthOutcomes(days ?? ALL_TIME_OUTCOME_DAYS);

  if (query.isLoading) return <CardSkeleton lines={5} className="rounded-2xl" />;
  if (query.isError || !query.data) {
    return (
      <HealthCard title={t("title")} plain={plain}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </HealthCard>
    );
  }

  const data = query.data;
  const pct = (n: number | null) => (n === null ? DASH : `${n}%`);

  return (
    <HealthCard title={t("title")} plain={plain}>
      {data.cases === 0 ? (
        <EmptyState
          title={days === undefined ? t("emptyTitleAll") : t("emptyTitle", { days })}
          description={t("emptyDescription")}
          className="py-8"
        />
      ) : (
        <div className={cn("flex flex-col gap-6 transition-opacity", query.isFetching && "opacity-70")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label={t("cases")} value={data.cases} caption={t("openCount", { count: data.openCases })} />
            <Kpi label={t("recoveryRate")} value={pct(data.recoveryRate)} caption={t("recoveredOf", { recovered: data.recovered, deaths: data.mortality })} />
            <Kpi label={t("avgDays")} value={data.avgDaysToRecover === null ? DASH : t("daysValue", { count: data.avgDaysToRecover })} />
            <Kpi label={t("avgCost")} value={data.avgCost === null ? DASH : <MoneyText amount={data.avgCost} />} caption={t("avgCostHint")} />
            <Kpi label={t("recurrence")} value={pct(data.recurrenceRate)} caption={t("recurrenceHint")} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">{t("byCondition")}</p>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("condition")}</TableHead>
                    <TableHead className="text-right">{t("cases")}</TableHead>
                    <TableHead className="text-right">{t("recoveryRate")}</TableHead>
                    <TableHead className="text-right">{t("avgDays")}</TableHead>
                    <TableHead className="text-right">{t("avgCost")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCondition.map((row) => (
                    <TableRow key={row.condition ?? "none"}>
                      <TableCell className="font-medium text-foreground">
                        {row.condition ? tCondition(`conditionValue.${row.condition as HealthCondition}`) : t("noCondition")}
                      </TableCell>
                      <TableCell className="text-right text-foreground">{row.cases}</TableCell>
                      <TableCell className="text-right text-foreground">{pct(row.recoveryRate)}</TableCell>
                      <TableCell className="text-right text-foreground">
                        {row.avgDaysToRecover === null ? DASH : t("daysValue", { count: row.avgDaysToRecover })}
                      </TableCell>
                      <TableCell className="text-right text-foreground">{row.avgCost === null ? DASH : <MoneyText amount={row.avgCost} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.otherClosed > 0 ? <p className="text-xs text-muted-foreground">{t("otherClosedNote", { count: data.otherClosed })}</p> : null}
          </div>
        </div>
      )}
    </HealthCard>
  );
}
