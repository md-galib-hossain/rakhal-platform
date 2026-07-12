"use client"; // recharts renders to the DOM — client-only, loaded via next/dynamic in the parent

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  /** Solid area fill (the "actual" series) vs a plain dashed line (a comparison/target series). */
  variant?: "area" | "line";
}

/**
 * Generic 1–2 series time-trend chart — shared by the cattle detail Overview tab's weight-history
 * and lactation-curve cards and the Finance tab's monthly income-vs-cost card, matching the same
 * dashed-gridline / soft-gradient-fill / K-abbreviated-axis style as the dashboard's charts
 * (`financial-performance-chart-inner.tsx`) rather than inventing a second chart style.
 */
export default function TrendChartInner<T extends object>({
  data,
  xKey,
  series,
  minWidth = 480,
  height = 200,
}: {
  data: T[];
  xKey: string;
  series: TrendSeries[];
  minWidth?: number;
  height?: number;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth }}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {series
                .filter((s) => s.variant !== "line")
                .map((s) => (
                  <linearGradient key={s.key} id={`trendFill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis width={36} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {series.map((s) =>
              s.variant === "line" ? (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              ) : (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#trendFill-${s.key})`}
                  dot={false}
                />
              ),
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
