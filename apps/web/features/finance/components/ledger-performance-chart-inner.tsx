"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LedgerChartMonth } from "../types";

const formatK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`);

/** Same color scheme as the dashboard's own "Financial Performance Over Time" widget
 * (`features/dashboard/components/financial-performance-chart-inner.tsx`, Figma node 732:1864) —
 * this ledger card is the same chart shape over the same `FinanceTransaction` data, just backed by
 * `finance.service.ts#ledgerChart` (year-to-date, recomputed on every `GET /finance/ledger` call)
 * instead of the dashboard's own `GET /dashboard/financial-performance` (rolling 12 months). */
const COLOR = { income: "#007fff", expense: "#f43f5e", profit: "#10b981" };

export default function LedgerPerformanceChartInner({
  months,
  labels,
}: {
  months: LedgerChartMonth[];
  labels: { income: string; expense: string; profit: string };
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[640px]">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ledgerPerformanceProfitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.profit} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLOR.profit} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickFormatter={(month: string) => month.slice(5)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis tickFormatter={formatK} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
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
            <Line type="monotone" dataKey="income" name={labels.income} stroke={COLOR.income} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            <Line type="monotone" dataKey="expense" name={labels.expense} stroke={COLOR.expense} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            <Area
              type="monotone"
              dataKey="profit"
              name={labels.profit}
              stroke={COLOR.profit}
              strokeWidth={2}
              fill="url(#ledgerPerformanceProfitFill)"
              baseValue="dataMin"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
