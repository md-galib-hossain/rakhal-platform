"use client"; // recharts renders to the DOM — client-only, loaded via next/dynamic in the parent

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Single-series vertical bar chart — used by the Overview tab's "Lifetime Yield by year" card
 * (Figma B1-S6's amber bar chart). Kept separate from `trend-chart-inner.tsx` since bars vs.
 * lines/areas are visually and structurally distinct chart types, not just a style variant. */
export default function BarChartInner({
  data,
  xKey,
  yKey,
  color = "var(--warning)",
  minWidth = 280,
  height = 200,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
  minWidth?: number;
  height?: number;
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div style={{ minWidth }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
            <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
