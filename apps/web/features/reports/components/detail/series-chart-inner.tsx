"use client"; // recharts renders to the DOM — client-only, loaded via next/dynamic by metric-series-card

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface SeriesChartPoint {
  key: string;
  /** null = no record for that day: a gap in the line, never zero. */
  y: number | null;
  shortLabel: string;
  valueText: string;
}

export default function SeriesChartInner({ data, name }: { data: SeriesChartPoint[]; name: string }) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[420px]">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="reportSeriesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-production)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-production)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="shortLabel"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              formatter={(_v, _n, item) => [(item.payload as SeriesChartPoint).valueText, name]}
              contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="y"
              name={name}
              stroke="var(--chart-production)"
              strokeWidth={2}
              fill="url(#reportSeriesFill)"
              connectNulls={false}
              dot={{ r: 2.5, fill: "var(--chart-production)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
