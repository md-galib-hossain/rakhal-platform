"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ConceptionRateResponse } from "../types";

/** Figma-exact colors (node 732:2250) — Monthly Conception emerald-600 #059669, Avg. Rate orange-300
 * #ffbf54 (with a soft gradient fill under the line, the only filled series). */
const COLOR = { count: "#059669", rate: "#ffbf54" };

/** Matches the Figma "Conception Rate" card: monthly confirmed-pregnancy bars with an average-rate
 * area overlay — bars and the rate% line each keep their own Y-axis scale. Wrapped in its own
 * `overflow-x-auto` with a `min-w` floor — on a narrow viewport the 12 months scroll horizontally
 * inside the chart instead of squeezing every bar unreadably, while the card itself stays full-width. */
export default function ConceptionRateChartInner({
  months,
  labels,
}: {
  months: ConceptionRateResponse["months"];
  labels: { monthlyConception: string; avgRate: string };
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[560px]">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="conceptionRateFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.rate} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLOR.rate} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickFormatter={(label: string) => label.toUpperCase()}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              yAxisId="count"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, _name, item) => [
                item.dataKey === "ratePct" ? `${value}%` : value,
                item.dataKey === "ratePct" ? labels.avgRate : labels.monthlyConception,
              ]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              yAxisId="count"
              dataKey="confirmedPregnancies"
              name={labels.monthlyConception}
              fill={COLOR.count}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Area
              yAxisId="rate"
              type="monotone"
              dataKey="ratePct"
              name={labels.avgRate}
              stroke={COLOR.rate}
              strokeWidth={2}
              fill="url(#conceptionRateFill)"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
