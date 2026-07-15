"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLOR = "#00a86b"; // --primary

export default function MorbidityTrendChartInner({
  points,
  label,
}: {
  points: { date: string; count: number }[];
  label: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[500px]">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="morbidityTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, label]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name={label}
              stroke={COLOR}
              strokeWidth={2}
              fill="url(#morbidityTrendFill)"
              baseValue="dataMin"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
