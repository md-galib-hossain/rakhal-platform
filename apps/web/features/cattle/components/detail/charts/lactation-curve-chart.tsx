"use client"; // live query + dynamic chart import + overlay toggle interaction

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/shared/chart-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLactationCompare, useLactationCompareGroups } from "@/features/reproduction/hooks/use-lactation-compare";
import { useLactationCurve } from "@/features/reproduction/hooks/use-lactation-curve";
import type { LactationCurveRow } from "./lactation-curve-chart-inner";

const LactationCurveChartInner = dynamic(() => import("./lactation-curve-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

type OverlayMode = "none" | "previous" | "group";

/** Mirrors the backend's `DIM_RANGE_BUCKETS` (`lactation-comparison.ts`) client-side — only the
 * `dimRange` grouping lines up with a DIM-axis chart (`parity`/`shed` describe cows,
 * not days-in-milk), so the "farm average" overlay always uses `groupBy=dimRange`. */
const DIM_RANGE_BUCKETS: { key: string; min: number; max: number | null }[] = [
  { key: "0-60", min: 0, max: 60 },
  { key: "61-120", min: 61, max: 120 },
  { key: "121-200", min: 121, max: 200 },
  { key: "201-305", min: 201, max: 305 },
  { key: "306+", min: 306, max: null },
];

function farmAvgForDim(
  buckets: { bucketKey: string; avgSevenDayYield: number }[] | undefined,
  dim: number,
): number | null {
  if (!buckets?.length) return null;
  const range =
    DIM_RANGE_BUCKETS.find((b) => dim >= b.min && (b.max === null || dim <= b.max)) ??
    DIM_RANGE_BUCKETS[DIM_RANGE_BUCKETS.length - 1];
  return buckets.find((b) => b.bucketKey === range.key)?.avgSevenDayYield ?? null;
}

/**
 * Lactation curve chart with overlay toggle (RAKHAL-292-F). Default series is the cow's current
 * lactation, daily yield by DIM with per-day data-quality markers (RAKHAL-283 — `complete`/
 * `incomplete`/`missing`, never silently zero-filled). The overlay toggle adds either the cow's own
 * previous lactation (`GET .../curve?compareLactationId=`, DIM-aligned) or the farm-wide average
 * yield per DIM-range bucket (`GET .../compare/groups?groupBy=dimRange`, RAKHAL-287).
 *
 * Not built on the generic `TrendChartInner` (the Overview tab's simpler `lactation_curve` card) —
 * that wrapper only supports a whole-series solid/dashed line, not per-point quality markers, which
 * this ticket's AC requires.
 */
export function LactationCurveChart({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.reproduction.lactationCurve");
  const [overlay, setOverlay] = useState<OverlayMode>("none");

  const compare = useLactationCompare(cattleId);
  const currentLactationId = compare.data?.current.lactationId;
  const previousLactationId = compare.data?.previous?.lactationId;

  const curve = useLactationCurve(currentLactationId, overlay === "previous" ? previousLactationId : undefined);
  const groups = useLactationCompareGroups("dimRange", overlay === "group");

  const rows = useMemo<LactationCurveRow[]>(() => {
    const series = curve.data?.series ?? [];
    const compareByDim = new Map((curve.data?.compareSeries ?? []).map((p) => [p.dim, p]));
    return series.map((p) => ({
      dim: p.dim,
      currentYieldL: p.yieldL,
      currentQuality: p.dataQuality,
      previousYieldL: overlay === "previous" ? (compareByDim.get(p.dim)?.yieldL ?? null) : null,
      previousQuality: overlay === "previous" ? (compareByDim.get(p.dim)?.dataQuality ?? null) : null,
      farmAvgYieldL: overlay === "group" ? farmAvgForDim(groups.data, p.dim) : null,
    }));
  }, [curve.data, groups.data, overlay]);

  const isLoading = compare.isLoading || curve.isLoading || (overlay === "group" && groups.isLoading);
  const isError = compare.isError || curve.isError || (overlay === "group" && groups.isError);
  const previousKnown = !compare.isLoading;

  return (
    <ChartCard
      title={t("title")}
      rangeControl={
        <Select value={overlay} onValueChange={(v) => setOverlay(v as OverlayMode)}>
          <SelectTrigger className="h-auto w-auto gap-1.5 rounded-md border-border px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs [&_svg]:size-3.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="none">{t("overlay.none")}</SelectItem>
            <SelectItem value="previous" disabled={previousKnown && !previousLactationId}>
              {t("overlay.previous")}
            </SelectItem>
            <SelectItem value="group">{t("overlay.group")}</SelectItem>
          </SelectContent>
        </Select>
      }
      legend={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-info" />
            <p className="text-xs font-medium text-muted-foreground">{t("series.current")}</p>
          </span>
          {overlay === "previous" ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full border border-dashed border-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">{t("series.previous")}</p>
            </span>
          ) : null}
          {overlay === "group" ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full border border-dashed border-success" />
              <p className="text-xs font-medium text-muted-foreground">{t("series.farmAverage")}</p>
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-info" />
            <p className="text-xs font-medium text-muted-foreground">{t("quality.incomplete")}</p>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-destructive">✕</span>
            <p className="text-xs font-medium text-muted-foreground">{t("quality.missing")}</p>
          </span>
        </div>
      }
    >
      {isLoading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : isError ? (
        <ErrorState
          description={t("error")}
          onRetry={() => {
            compare.refetch();
            curve.refetch();
            groups.refetch();
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState title={t("noData")} className="py-8" />
      ) : (
        <>
          <LactationCurveChartInner
            data={rows}
            showPrevious={overlay === "previous"}
            showFarmAvg={overlay === "group"}
            qualityLabels={{
              complete: t("quality.complete"),
              incomplete: t("quality.incomplete"),
              missing: t("quality.missing"),
            }}
            seriesLabels={{
              current: t("series.current"),
              previous: t("series.previous"),
              farmAverage: t("series.farmAverage"),
            }}
          />
          {overlay === "previous" && previousKnown && !previousLactationId ? (
            <p className="mt-2 text-xs text-muted-foreground">{t("noPreviousLactation")}</p>
          ) : null}
        </>
      )}
    </ChartCard>
  );
}
