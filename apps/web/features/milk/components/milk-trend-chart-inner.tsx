"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MilkOverviewResponse } from "../types";

const COLOR = "var(--success)";

export default function MilkTrendChartInner({
  trend,
  label,
  compact = false,
}: {
  trend: MilkOverviewResponse["trend"];
  label: string;
  compact?: boolean;
}) {
  if (compact) {
    if (!trend || trend.length === 0) {
      return (
        <div className="flex h-[220px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-4 text-center">
          <p className="text-xs text-muted-foreground">No milk production recorded in this period</p>
        </div>
      );
    }
    return (
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="milkTrendFillCompact" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => date.slice(8, 10)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value: number) => `${value}L`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => [`${value} L`, label]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="totalL" name={label} stroke={COLOR} strokeWidth={2} fill="url(#milkTrendFillCompact)" dot={false} isAnimationActive={false} animationDuration={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[560px]">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="milkTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => date.slice(8, 10)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(value: number) => `${value}L`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [`${value} L`, label]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="totalL" name={label} stroke={COLOR} strokeWidth={2} fill="url(#milkTrendFill)" dot={false} isAnimationActive={false} animationDuration={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
