"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductionVsFeedcostResponse } from "../types";

/** Figma-exact colors (node 732:2017) — Production emerald-600 #059669, Feedcost orange-300 #ffbf54. */
const COLOR = { production: "#059669", feedcost: "#ffbf54" };

/** Matches the Figma "Production vs Feedcost" card: two vertical bars per day (production in
 * litres, feedcost in Tk) over the current month — production and feedcost use their own Y-axis
 * scale since litres and currency aren't comparable magnitudes. Wrapped in its own `overflow-x-auto`
 * with a `min-w` floor (31 days is the widest of the 3 new charts) — on a narrow viewport the days
 * scroll horizontally inside the chart instead of squeezing every bar unreadably, while the card
 * itself stays full-width. */
export default function ProductionVsFeedcostChartInner({
  days,
  labels,
}: {
  days: ProductionVsFeedcostResponse["days"];
  labels: { production: string; feedcost: string };
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[900px]">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={days} barGap={2} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <YAxis
              yAxisId="production"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(v: number) => `${v}L`}
            />
            <YAxis
              yAxisId="feedcost"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`)}
            />
            <Tooltip
              formatter={(value, _name, item) => [
                item.dataKey === "productionL" ? `${value}L` : `৳${Number(value).toLocaleString()}`,
                item.dataKey === "productionL" ? labels.production : labels.feedcost,
              ]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar yAxisId="production" dataKey="productionL" name={labels.production} fill={COLOR.production} radius={[2, 2, 0, 0]} maxBarSize={6} />
            <Bar yAxisId="feedcost" dataKey="feedcost" name={labels.feedcost} fill={COLOR.feedcost} radius={[2, 2, 0, 0]} maxBarSize={6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
