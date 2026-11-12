"use client"; // live query + dynamic chart imports

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { DrillBody, DrillCard, DrillStat, DrillStats } from "../workspace/drill/drill-template";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useCalfDetail } from "@/features/calves/hooks/use-calves";
import { WeightTab as CalfWeightTab } from "@/features/calves/components/detail/weight-tab";
import { MilkQualityTestsSection } from "@/features/milk/components/milk-quality-tests-section";
import { useCattleOverview, useWeightHistory } from "../../hooks/use-cattle-detail-tabs";
import type { WeightHistoryPeriod } from "../../detail-types";
import type { AnimalCategory, CattleGender, LactationStage } from "../../types";
import { RecordBcsDialog } from "./record-bcs-dialog";
import { RecordWeightDialog } from "./record-weight-dialog";
import { WeightPeriodSelect } from "./charts/weight-period-select";
import { LactationSummaryCard } from "./lactation-summary-card";
import { LactationCurveChart } from "./charts/lactation-curve-chart";

const TrendChartInner = dynamic(() => import("./charts/trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});
const BarChartInner = dynamic(() => import("./charts/bar-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full" />,
});

/**
 * Performance tab (unified animal-profile redesign, no ticket #) — renamed from the former
 * "Overview"/"Production" tab (Figma B1-S5/B1-S6, `GET /cattle/:id/overview`), since "Production"
 * only made sense for a lactating cow; "Performance" reads correctly across every life stage
 * (growth for a calf/heifer, milk+body performance for a cow). `FeedTodayCard` moved to `FeedingTab`
 * — feeding content belongs in Feeding, not Performance. For `CALF` rows this tab is just the calf's
 * own weight/growth content (`CalfWeightTab`, reused from the calf module) — birth weight/ADG/
 * weaning-target stay on the (calf-only) Overview tab, unchanged. The Figma "Weight vs Target" chart
 * has no `target` counterpart in the backend (no per-animal weight-target concept anywhere in the
 * schema) — rendered as actual weight only rather than fabricating a target line, flagged here not
 * silently dropped.
 */
export function PerformanceTab({
  cattleId,
  gender,
  lactationStage,
  animalCategory,
}: {
  cattleId: string;
  gender: CattleGender;
  lactationStage?: LactationStage | null;
  animalCategory: AnimalCategory;
}) {
  const isCalf = animalCategory === "CALF";
  const calfQuery = useCalfDetail(isCalf ? cattleId : undefined);

  if (isCalf) {
    if (calfQuery.isLoading) return <CardSkeleton lines={3} />;
    if (calfQuery.isError || !calfQuery.data) {
      return <ErrorState onRetry={() => calfQuery.refetch()} />;
    }
    return <CalfWeightTab calfId={cattleId} data={calfQuery.data} />;
  }

  return <NonCalfPerformanceTab cattleId={cattleId} gender={gender} lactationStage={lactationStage} />;
}

/** Muted sub-line for a % change: "+4%" / "−2%", nothing when absent. */
function pct(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  return `${v > 0 ? "+" : ""}${v}%`;
}

function NonCalfPerformanceTab({
  cattleId,
  gender,
  lactationStage,
}: {
  cattleId: string;
  gender: CattleGender;
  lactationStage?: LactationStage | null;
}) {
  const t = useTranslations("cattle.detail.performance");
  const tReproduction = useTranslations("cattle.detail.reproduction");
  const locale = useLocale() as Locale;
  const isFemale = gender === "FEMALE";
  const query = useCattleOverview(cattleId);
  const [bcsDialogOpen, setBcsDialogOpen] = useState(false);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightPeriod, setWeightPeriod] = useState<WeightHistoryPeriod>("month");
  const weightHistoryQuery = useWeightHistory(cattleId, weightPeriod);

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-4">
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

  const weightDateFormat: Intl.DateTimeFormatOptions =
    weightPeriod === "year"
      ? { year: "numeric" }
      : weightPeriod === "month"
        ? { month: "short", year: "numeric" }
        : { month: "short", day: "numeric" };
  const weightData = (weightHistoryQuery.data?.points ?? []).map((p) => ({
    date: formatDate(p.date, locale, weightDateFormat),
    weight: p.weightKg,
  }));
  const lifetimeData = data.lifetime_yield.map((p) => ({ year: p.year, total: p.total_l }));

  return (
    <DrillBody>
      <DrillStats>
        <DrillStat label={t("aqrScore")} value={data.aqr_score ?? "—"} muted={data.aqr_score == null} hint={pct(data.aqr_change_pct)} />
        <DrillStat label={t("avgDailyYield")} value={t("litres", { value: data.avg_daily_yield_7d })} hint={pct(data.yield_change_pct)} />
        <DrillStat
          label={t("liveWeight")}
          value={data.last_weight_kg != null ? t("kg", { value: data.last_weight_kg }) : "—"}
          muted={data.last_weight_kg == null}
          hint={pct(data.weight_change_pct)}
        />
      </DrillStats>

      <div className="flex flex-wrap gap-2">
        <Can I="cattle.bcs">
          <Button variant="outline" size="sm" onClick={() => setBcsDialogOpen(true)}>
            {t("recordBcs")}
          </Button>
        </Can>
        <Can I="cattle.update">
          <Button variant="outline" size="sm" onClick={() => setWeightDialogOpen(true)}>
            {t("recordWeight")}
          </Button>
        </Can>
      </div>
      <RecordBcsDialog cattleId={cattleId} open={bcsDialogOpen} onOpenChange={setBcsDialogOpen} />
      <RecordWeightDialog cattleId={cattleId} open={weightDialogOpen} onOpenChange={setWeightDialogOpen} />

      <DrillCard
        title={t("weightHistory")}
        action={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-3 rounded-full bg-success" />
              <span className="text-xs font-medium text-muted-foreground">{t("actual")}</span>
            </span>
            <WeightPeriodSelect value={weightPeriod} onChange={setWeightPeriod} />
          </div>
        }
      >
        {weightHistoryQuery.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : weightData.length === 0 ? (
          <EmptyState title={t("noWeightRecords")} className="py-8" />
        ) : (
          <TrendChartInner
            data={weightData}
            xKey="date"
            series={[{ key: "weight", label: t("weightKg"), color: "var(--success)" }]}
          />
        )}
      </DrillCard>

      {isFemale ? (
        <>
          {/* RAKHAL-291-F — Lactation Summary card (today/7d/30d yield, totals by disposition, peak,
              persistency, milk eligibility). Pure milk-yield content belongs on Performance, not
              alongside breeding/calving data. */}
          <LactationSummaryCard cattleId={cattleId} lactationStage={lactationStage} />

          {/* RAKHAL-292-F — lactation curve (current lactation, DIM-indexed, per-day data-quality
              markers) with a toggle to overlay the previous lactation or the farm-wide DIM-range
              average. */}
          <LactationCurveChart cattleId={cattleId} />
        </>
      ) : null}

      <DrillCard title={t("lifetimeYield")}>
        {lifetimeData.length === 0 ? (
          <EmptyState title={t("noLifetimeData")} className="py-8" />
        ) : (
          <BarChartInner data={lifetimeData} xKey="year" yKey="total" minWidth={280} />
        )}
      </DrillCard>

      <DrillCard title={t("recentRecords")}>
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
      </DrillCard>

      <MilkQualityTestsSection cattleId={cattleId} />
    </DrillBody>
  );
}
