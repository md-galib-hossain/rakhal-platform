"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface StateBar {
  state: string;
  count: number;
  color: string;
}

/** Bare bar chart — colors come straight from the backend's `GET /dashboard/livestock-state` response. */
export default function LivestockStateChartInner({ bars }: { bars: StateBar[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={bars}>
        <XAxis dataKey="state" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
        <Tooltip cursor={{ fill: "var(--color-muted)" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {bars.map((bar) => (
            <Cell key={bar.state} fill={bar.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
