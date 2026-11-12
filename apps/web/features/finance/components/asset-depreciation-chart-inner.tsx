"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AssetDepreciationRow } from "../types";

/** Figma-matched colors (node `1039:34161` legend) — Book Value blue #007FFF, Accumulated
 * Depreciation amber #F59E0B. Grouped bar per fixed asset, same shape as the dashboard's own
 * Production vs Feedcost chart (`production-vs-feedcost-chart-inner.tsx`). */
const COLOR = { bookValue: "#007fff", accumulatedDepreciation: "#f59e0b" };

const formatK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`);

export default function AssetDepreciationChartInner({
  rows,
  labels,
}: {
  rows: AssetDepreciationRow[];
  labels: { bookValue: string; accumulatedDepreciation: string };
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[420px]">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rows} barGap={4} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="asset_name"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis tickFormatter={formatK} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              formatter={(value, _name, item) => [
                `৳${Number(value).toLocaleString()}`,
                item.dataKey === "book_value" ? labels.bookValue : labels.accumulatedDepreciation,
              ]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="book_value" name={labels.bookValue} fill={COLOR.bookValue} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar
              dataKey="accumulated_depreciation"
              name={labels.accumulatedDepreciation}
              fill={COLOR.accumulatedDepreciation}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
