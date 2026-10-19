"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancialPerformanceResponse } from "../types";

const formatK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`);

/** Figma-exact colors (node 732:1864) — Income #007FFF, Expense #F43F5E (both dashed, no fill),
 * Profit #10B981 (solid, with a soft gradient area fill underneath — the only filled series). */
const COLOR = { income: "var(--chart-income)", expense: "var(--chart-expense)", profit: "var(--chart-profit)" };

/** Matches the Figma "Financial Performance Over Time" card pixel-for-pixel: dashed Income/Expense
 * lines, a solid Profit line with a gradient fill fading to transparent, dashed gridlines, no dots,
 * uppercase month ticks, values abbreviated to K on the Y axis. Wrapped in its own `overflow-x-auto`
 * with a `min-w` floor — on a narrow viewport the 12 months scroll horizontally inside the chart
 * instead of squeezing every tick unreadably, while the card itself stays full-width. */
export default function FinancialPerformanceChartInner({
  months,
  labels,
}: {
  months: FinancialPerformanceResponse["months"];
  labels: { income: string; expense: string; profit: string };
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[640px]">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="financialPerformanceProfitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.profit} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLOR.profit} stopOpacity={0} />
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
              tickFormatter={formatK}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, _name, item) => [
                `৳${Number(value).toLocaleString()}`,
                item.dataKey === "income" ? labels.income : item.dataKey === "expense" ? labels.expense : labels.profit,
              ]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="income"
              name={labels.income}
              stroke={COLOR.income}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name={labels.expense}
              stroke={COLOR.expense}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name={labels.profit}
              stroke={COLOR.profit}
              strokeWidth={2}
              fill="url(#financialPerformanceProfitFill)"
              // Recharts fills to y=0 by default, so a negative Profit dip makes the shading
              // sit above the line instead of below it. "dataMin" anchors the fill to the
              // series' own minimum so it's always below the line, regardless of sign.
              baseValue="dataMin"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
