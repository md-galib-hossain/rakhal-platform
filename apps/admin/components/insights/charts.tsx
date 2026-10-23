import type { ReactNode } from "react";
import type { DayCount } from "@/lib/api/directory";
import { formatCount } from "@/lib/format";

/** Short "12 Oct" label from a `YYYY-MM-DD` day, rendered in UTC so the label matches the API's day bucket. */
function shortDay(day: string | undefined): string {
  if (!day) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Dependency-free line + area chart for a daily series. Server-rendered SVG: no JS, themed from tokens
 * (`currentColor` on a `text-primary` wrapper), with a text alternative and a native tooltip per day.
 */
export function TrendChart({ title, series, unit = "users" }: { title: string; series: DayCount[]; unit?: string }) {
  const W = 600;
  const H = 160;
  const PAD = { t: 8, r: 8, b: 4, l: 8 };
  const max = Math.max(1, ...series.map((d) => d.count));
  const top = Math.ceil(max / 4) * 4 || 4;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (series.length <= 1 ? 0 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / top) * innerH;
  const line = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const area = series.length ? `${line} L${x(series.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z` : "";
  const last = series[series.length - 1];
  const peak = series.reduce((a, d) => (d.count > a.count ? d : a), series[0] ?? { day: "", count: 0 });

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground">
          Today {formatCount(last?.count ?? 0)} · peak {formatCount(peak.count)} on {shortDay(peak.day)}
        </span>
      </figcaption>
      <div className="text-primary">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: ${formatCount(last?.count ?? 0)} ${unit} today, peak ${formatCount(peak.count)} on ${shortDay(peak.day)}`}
          className="h-40 w-full overflow-visible"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={PAD.t + innerH * f}
              y2={PAD.t + innerH * f}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={f === 1 ? undefined : "3 4"}
            />
          ))}
          {area ? <path d={area} fill="currentColor" opacity={0.12} /> : null}
          {line ? (
            <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ) : null}
          {series.map((d, i) => (
            <rect key={d.day} x={x(i) - innerW / series.length / 2} y={0} width={innerW / series.length} height={H} fill="transparent">
              <title>{`${shortDay(d.day)}: ${formatCount(d.count)} ${unit}`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{shortDay(series[0]?.day)}</span>
        <span>{shortDay(series[Math.floor(series.length / 2)]?.day)}</span>
        <span>{shortDay(last?.day)}</span>
      </div>
    </figure>
  );
}

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Secondary text right of the value, e.g. "42% of active farms". */
  hint?: string;
}

/** Ranked horizontal bars. Width is relative to the largest value; the number is always printed, never colour-only. */
export function BarList({ items, caption }: { items: BarItem[]; caption: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={caption} className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground">{item.label}</span>
            <span className="shrink-0 tabular-nums text-foreground">
              {formatCount(item.value)}
              {item.hint ? <span className="ml-2 text-xs text-muted-foreground">{item.hint}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One rate (activation, retention) as a big percentage over a meter, with the counts behind it. */
export function RateTile({ label, rate, detail, hint }: { label: string; rate: number | null; detail: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {rate === null ? (
        <p className="mt-1 text-sm text-muted-foreground">Not enough data yet</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{rate}%</p>
          <div
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rate}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, rate)}%` }} />
          </div>
        </>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Plain KPI tile used on the analytics views (the Overview uses the shared `StatCard`). */
export function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
