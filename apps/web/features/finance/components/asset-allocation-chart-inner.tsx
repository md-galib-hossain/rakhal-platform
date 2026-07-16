"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AssetAllocationSlice } from "../types";

/** Bare donut, no center label — matches the Figma "Asset Allocation" card (node `1039:34119`),
 * which centers nothing inside the ring (unlike the dashboard's own donut). Real colors come
 * straight from `finance.service.ts#assets`' `allocation[].color` — not re-picked to match the
 * Figma mock's own emerald/blue/cyan/indigo/rose palette, since the backend already assigns a
 * distinct, meaningful color per category. */
export default function AssetAllocationChartInner({ slices }: { slices: AssetAllocationSlice[] }) {
  return (
    <div className="relative mx-auto size-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="category" innerRadius={70} outerRadius={100} paddingAngle={2}>
            {slices.map((slice) => (
              <Cell key={slice.category} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `৳${Number(value).toLocaleString()}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
