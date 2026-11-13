"use client"; // dynamic (ssr:false) chart import

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import type { Locale } from "@/lib/constants/i18n";
import { formatDate, formatNumber } from "@/lib/format";
import { formatMetricValue } from "../../lib/format";
import { resolveMetricLabel, resolveSourceLabel, type ReportTranslator } from "../../lib/labels";
import type { MetricResult } from "../../types";
import { MetricComparison } from "./metric-comparison";
import type { MetricLabels } from "./metric-stat-card";
import type { SeriesChartPoint } from "./series-chart-inner";

const SeriesChartInner = dynamic(() => import("./series-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

type Translate = (key: string, values?: Record<string, string | number>) => string;

function shortLabel(key: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  return formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), locale, { day: "numeric", month: "short" });
}

/**
 * A per-day series. Days with no record are gaps in the line (y = null), never zero, and are counted in a note.
 * Text alternative: the figure carries an aria-label summary and a visually hidden table of every day.
 */
export function MetricSeriesCard({
  metric,
  locale,
  tr,
  t,
  labels,
}: {
  metric: MetricResult;
  locale: Locale;
  tr: ReportTranslator;
  t: Translate;
  labels: MetricLabels;
}) {
  const series = metric.series ?? [];
  const name = resolveMetricLabel(metric.metricId, tr);
  const source = resolveSourceLabel(metric.source, tr);
  const data: SeriesChartPoint[] = series.map((p) => ({
    key: p.key,
    y: p.value.state === "value" && Number.isFinite(p.value.value) ? p.value.value : null,
    shortLabel: shortLabel(p.key, locale),
    valueText: formatMetricValue(p.value, locale, tr),
  }));
  const ys = data.flatMap((d) => (d.y === null ? [] : [d.y]));
  const recorded = ys.length;
  const gaps = data.length - recorded;
  const firstValue = series.find((p) => p.value.state === "value");
  const unitText = firstValue && firstValue.value.state === "value" ? firstValue.value.unit : "";
  const fmt = (n: number) => formatMetricValue({ state: "value", value: n, unit: unitText }, locale, tr);
  const total = formatNumber(data.length, locale);
  const summary =
    recorded > 0
      ? t("metric.chartSummary", {
          name,
          recorded: formatNumber(recorded, locale),
          total,
          max: fmt(Math.max(...ys)),
          min: fmt(Math.min(...ys)),
        })
      : `${name}: ${t("metric.recordedDays", { recorded: 0, total })}`;

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card sm:col-span-2 lg:col-span-3" data-metric-id={metric.metricId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-sm font-medium text-foreground">{name}</h4>
          {source ? <p className="text-xs text-muted-foreground">{source}</p> : null}
          <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums text-foreground">{formatMetricValue(metric.value, locale, tr)}</p>
        </div>
        {metric.comparison ? (
          <MetricComparison comparison={metric.comparison} labels={labels} locale={locale} tr={tr} />
        ) : null}
      </div>
      {recorded > 0 ? (
        <figure role="img" aria-label={summary} className="m-0">
          <SeriesChartInner data={data} name={name} />
          <table className="sr-only">
            <caption>{name}</caption>
            <tbody>
              {data.map((d) => (
                <tr key={d.key}>
                  <th scope="row">{d.shortLabel}</th>
                  <td>{d.valueText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      ) : null}
      {gaps > 0 ? <p className="text-xs text-muted-foreground">{t("metric.noRecordDays", { count: gaps })}</p> : null}
    </Card>
  );
}
