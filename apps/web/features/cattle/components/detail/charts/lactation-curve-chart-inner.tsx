"use client"; // recharts renders to the DOM — client-only, loaded via next/dynamic in the parent

import { ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DimDataQuality } from "@/features/reproduction/types";

export interface LactationCurveRow {
  dim: number;
  currentYieldL: number | null;
  currentQuality: DimDataQuality | null;
  previousYieldL: number | null;
  previousQuality: DimDataQuality | null;
  farmAvgYieldL: number | null;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: LactationCurveRow;
}

/** Data-quality marker for the current-lactation line (RAKHAL-283's AC — a day is never silently
 * treated as zero): `complete` days render no marker (just the line), `incomplete` a hollow ring,
 * `missing` an X — both distinct from the plain filled points a normal recharts `dot` would draw. */
function QualityDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload || payload.currentYieldL == null) return null;
  if (payload.currentQuality === "incomplete") {
    return <circle cx={cx} cy={cy} r={3.5} fill="var(--card)" stroke="var(--info)" strokeWidth={1.5} />;
  }
  if (payload.currentQuality === "missing") {
    return (
      <g stroke="var(--destructive)" strokeWidth={1.5}>
        <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} />
        <line x1={cx - 3} y1={cy + 3} x2={cx + 3} y2={cy - 3} />
      </g>
    );
  }
  return null;
}

function CurveTooltip({
  active,
  payload,
  label,
  qualityLabels,
  seriesLabels,
}: {
  active?: boolean;
  payload?: { payload: LactationCurveRow }[];
  label?: number;
  qualityLabels: Record<DimDataQuality, string>;
  seriesLabels: { current: string; previous: string; farmAverage: string };
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      className="rounded-lg border border-border p-2 text-xs shadow-sm"
      style={{ backgroundColor: "var(--card)" }}
    >
      <p className="mb-1 font-medium text-foreground">DIM {label}</p>
      {row.currentYieldL != null ? (
        <p className="text-muted-foreground">
          {seriesLabels.current}: <span className="text-foreground">{row.currentYieldL} L</span>
          {row.currentQuality && row.currentQuality !== "complete" ? ` (${qualityLabels[row.currentQuality]})` : ""}
        </p>
      ) : null}
      {row.previousYieldL != null ? (
        <p className="text-muted-foreground">
          {seriesLabels.previous}: <span className="text-foreground">{row.previousYieldL} L</span>
        </p>
      ) : null}
      {row.farmAvgYieldL != null ? (
        <p className="text-muted-foreground">
          {seriesLabels.farmAverage}: <span className="text-foreground">{row.farmAvgYieldL} L</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Bespoke lactation-curve chart (RAKHAL-292-F) — not the generic `TrendChartInner` since that
 * wrapper only supports a whole-series solid/dashed line style, not per-point data-quality markers.
 */
export default function LactationCurveChartInner({
  data,
  showPrevious,
  showFarmAvg,
  qualityLabels,
  seriesLabels,
  minWidth = 480,
  height = 220,
}: {
  data: LactationCurveRow[];
  showPrevious: boolean;
  showFarmAvg: boolean;
  qualityLabels: Record<DimDataQuality, string>;
  seriesLabels: { current: string; previous: string; farmAverage: string };
  minWidth?: number;
  height?: number;
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div style={{ minWidth }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="dim"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis width={36} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip content={<CurveTooltip qualityLabels={qualityLabels} seriesLabels={seriesLabels} />} />
            <Line
              type="monotone"
              dataKey="currentYieldL"
              name={seriesLabels.current}
              stroke="var(--info)"
              strokeWidth={2}
              dot={<QualityDot />}
              connectNulls
            />
            {showPrevious ? (
              <Line
                type="monotone"
                dataKey="previousYieldL"
                name={seriesLabels.previous}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
              />
            ) : null}
            {showFarmAvg ? (
              <Line
                type="stepAfter"
                dataKey="farmAvgYieldL"
                name={seriesLabels.farmAverage}
                stroke="var(--success)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
