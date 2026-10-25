"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

/** Bare donut with a centered total label — matches the Figma "Livestock Count" card (732:1737):
 * a ring of 4-5 slices with a "Total / N" label centered inside the hole. */
export default function HerdStatusChartInner({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: number;
}) {
  return (
    <div className="relative mx-auto size-[170px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius={62} outerRadius={85} paddingAngle={2}>
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs text-muted-foreground">{centerLabel}</p>
        <p className="text-[28px] font-bold leading-tight text-foreground">{centerValue}</p>
      </div>
    </div>
  );
}
