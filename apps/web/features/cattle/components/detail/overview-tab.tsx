"use client"; // live query + dynamic chart imports

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Utensils } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { ChartCard } from "@/components/shared/chart-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { useConcentrations, useFeedEfficiency } from "@/features/feed/hooks/use-feed";
import { LogDistributionDialog } from "@/features/feed/components/log-distribution-dialog";
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
 * "Feed Today" (Phase 12.4, 2026-07-18, no Figma frame — new surface) — a cow's own Total Mixed
 * Ration(s) (a `FEED_MIXTURE` targeting exactly this `cattleId`) can be fed directly from her own
 * overview, without going to the Feed Formulator page. A button per matching TMR (usually one) rather
 * than a full dedicated tab — a v1 cut per the plan, easy to promote to a full feeding-history tab
 * later via `GET /feed/distributions?cattleId=`. Also surfaces a minimal efficiency `StatCard`
 * (adherence% + cost/litre) when this cow has any logged feeding history.
 */
function FeedTodayCard({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.overview");
  const concentrations = useConcentrations();
  const efficiency = useFeedEfficiency({ cattleId });
  const [feedTodayId, setFeedTodayId] = useState<string | null>(null);

  const myMixtures = useMemo(
    () =>
      (concentrations.data ?? []).filter((c) => c.kind === "FEED_MIXTURE" && c.cattle_id === cattleId),
    [concentrations.data, cattleId],
  );

  if (concentrations.isLoading || myMixtures.length === 0) return null;

  return (
    <>
      <Card className="flex flex-col gap-3 rounded-xl p-3">
        <p className="text-sm font-medium text-foreground">{t("feedToday")}</p>
        <div className="flex flex-col gap-2">
          {myMixtures.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
              <p className="truncate text-sm text-foreground">{c.name}</p>
              <Can I="feed.distribution-log">
                <Button variant="secondary" size="sm" className="gap-2" onClick={() => setFeedTodayId(c.id)}>
                  <Utensils className="size-4" aria-hidden />
                  {t("feedToday")}
                </Button>
              </Can>
            </div>
          ))}
        </div>
        {efficiency.data ? (
          <StatCard
            label={t("feedAdherence")}
            value={efficiency.data.adherence_pct != null ? `${efficiency.data.adherence_pct}%` : "—"}
          />
        ) : null}
      </Card>
      <LogDistributionDialog concentrationId={feedTodayId} onOpenChange={(open) => !open && setFeedTodayId(null)} />
    </>
  );
}

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

      <FeedTodayCard cattleId={cattleId} />

      <ChartCard
        title={t("weightHistory")}
        subtitle={t("weightHistorySubtitle")}
        legend={
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-3 rounded-full bg-success" />
            <p className="text-xs font-medium text-muted-foreground">{t("actual")}</p>
          </div>
        }
      >
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("lactationCurve")}>
          {lactationData.length === 0 ? (
            <EmptyState title={t("noLactationData")} className="py-8" />
          ) : (
            <TrendChartInner
              data={lactationData}
              xKey="dim"
              series={[{ key: "yield", label: t("yieldL"), color: "var(--info)" }]}
              minWidth={280}
            />
          )}
        </ChartCard>

        <ChartCard title={t("lifetimeYield")}>
          {lifetimeData.length === 0 ? (
            <EmptyState title={t("noLifetimeData")} className="py-8" />
          ) : (
            <BarChartInner data={lifetimeData} xKey="year" yKey="total" minWidth={280} />
          )}
        </ChartCard>
      </div>

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
