"use client"; // live query + dynamic chart imports

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { StatCard } from "@/components/shared/stat-card";
import { ChartCard } from "@/components/shared/chart-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCattleOverview } from "../../hooks/use-cattle-detail-tabs";

const TrendChartInner = dynamic(() => import("./charts/trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});
const BarChartInner = dynamic(() => import("./charts/bar-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full" />,
});

/**
 * Overview tab (Figma B1-S5/B1-S6) — backed by `GET /cattle/:id/overview`. The Figma "Weight vs
 * Target" chart has no `target` counterpart in the backend (no per-animal weight-target concept
 * anywhere in the schema) — rendered as actual weight only rather than fabricating a target line,
 * flagged here not silently dropped.
 */
export function OverviewTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.overview");
  const query = useCattleOverview(cattleId);

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;

  const weightData = data.weight_history
    .slice()
    .reverse()
    .map((r) => ({ date: r.date, weight: r.weight_kg }));
  const lactationData = data.lactation_curve.map((p) => ({ dim: p.dim, yield: p.yield_l }));
  const lifetimeData = data.lifetime_yield.map((p) => ({ year: p.year, total: p.total_l }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("aqrScore")} value={data.aqr_score ?? "—"} delta={data.aqr_change_pct ?? undefined} deltaLabel="%" />
        <StatCard
          label={t("avgDailyYield")}
          value={t("litres", { value: data.avg_daily_yield_7d })}
          delta={data.yield_change_pct ?? undefined}
          deltaLabel="%"
        />
        <StatCard
          label={t("liveWeight")}
          value={data.last_weight_kg != null ? t("kg", { value: data.last_weight_kg }) : "—"}
          delta={data.weight_change_pct ?? undefined}
          deltaLabel="%"
        />
      </div>

      <ChartCard title={t("weightHistory")}>
        {weightData.length === 0 ? (
          <EmptyState title={t("noWeightRecords")} className="py-8" />
        ) : (
          <TrendChartInner
            data={weightData}
            xKey="date"
            series={[{ key: "weight", label: t("weightKg"), color: "var(--success)" }]}
          />
        )}
      </ChartCard>

      <ChartCard title={t("lactationCurve")}>
        {lactationData.length === 0 ? (
          <EmptyState title={t("noLactationData")} className="py-8" />
        ) : (
          <TrendChartInner
            data={lactationData}
            xKey="dim"
            series={[{ key: "yield", label: t("yieldL"), color: "var(--info)" }]}
          />
        )}
      </ChartCard>

      <ChartCard title={t("lifetimeYield")}>
        {lifetimeData.length === 0 ? (
          <EmptyState title={t("noLifetimeData")} className="py-8" />
        ) : (
          <BarChartInner data={lifetimeData} xKey="year" yKey="total" />
        )}
      </ChartCard>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("recentRecords")}</h3>
        {data.recent_milk_records.length === 0 ? (
          <EmptyState title={t("noRecentRecords")} className="py-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead>{t("columns.morning")}</TableHead>
                <TableHead>{t("columns.noon")}</TableHead>
                <TableHead>{t("columns.evening")}</TableHead>
                <TableHead>{t("columns.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent_milk_records.map((r) => (
                <TableRow key={r.date}>
                  <TableCell>
                    <DateText date={r.date} />
                  </TableCell>
                  <TableCell>{r.morning_l} L</TableCell>
                  <TableCell>{r.noon_l} L</TableCell>
                  <TableCell>{r.evening_l} L</TableCell>
                  <TableCell className="font-medium text-success">{r.total_l} L</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
