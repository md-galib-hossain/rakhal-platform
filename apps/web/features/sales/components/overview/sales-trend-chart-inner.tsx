"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";

const COLOR = "var(--primary)";

/** RAKHAL-388 — line chart per the AC ("Sales Trend line chart with a By Day ▾ toggle"). Empty
 * buckets already render as zero, never a gap — `SalesSummaryService.queryTrend`'s own doc comment
 * (server walks the full range in Node, filling every bucket). */
export default function SalesTrendChartInner({
  trend,
  label,
  locale,
}: {
  trend: { bucket: string; amount: string }[];
  label: string;
  locale: Locale;
}) {
  const data = trend.map((t) => ({ bucket: t.bucket, amount: Number(t.amount) }));

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[560px]">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="bucket"
              tickFormatter={(date: string) => date.slice(5, 10)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(value: number) => formatMoney(value, locale)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              width={70}
            />
            <Tooltip
              formatter={(value) => [formatMoney(Number(value), locale), label]}
              labelFormatter={(date) => String(date).slice(0, 10)}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="amount" name={label} stroke={COLOR} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
