"use client"; // recharts renders to the DOM/canvas — client-only, loaded via next/dynamic in the parent

import { useLocale } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLOR = "var(--primary)";

type Bucket = "day" | "week" | "month";

/** Buckets are UTC calendar days from the server (`YYYY-MM-DD`), so format them in UTC too — a local-time format
 * would shift the label by a day in zones west of UTC. */
function formatBucket(date: string, bucket: Bucket, locale: string, long: boolean): string {
  const d = new Date(`${date}T00:00:00Z`);
  const options: Intl.DateTimeFormatOptions =
    bucket === "month"
      ? { month: "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: long ? "numeric" : undefined, timeZone: "UTC" };
  return d.toLocaleDateString(locale, options);
}

export default function MorbidityTrendChartInner({
  points,
  bucket,
  label,
  weekOfLabel,
}: {
  points: { date: string; count: number }[];
  bucket: Bucket;
  label: string;
  /** "Week of {date}" — the tooltip title for a weekly bar. */
  weekOfLabel: string;
}) {
  const locale = useLocale();

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={(value: string) => formatBucket(value, bucket, locale, false)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(max, 3)]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            labelFormatter={(value) => {
              const text = formatBucket(String(value), bucket, locale, true);
              return bucket === "week" ? `${weekOfLabel} ${text}` : text;
            }}
            formatter={(value) => [value, label]}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" name={label} fill={COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
