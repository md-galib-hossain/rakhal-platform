import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/constants/i18n";
import { cn } from "@/lib/utils";
import { formatMetricValue } from "../../lib/format";
import { resolveMetricLabel, resolveSourceLabel, type ReportTranslator } from "../../lib/labels";
import type { MetricResult } from "../../types";
import { MetricComparison } from "./metric-comparison";

export interface MetricLabels {
  previous: string;
  vsPrevious: string;
}

/** One scalar figure. Non-value states print their words ("Not recorded"), never 0. */
export function MetricStatCard({
  metric,
  locale,
  tr,
  labels,
}: {
  metric: MetricResult;
  locale: Locale;
  tr: ReportTranslator;
  labels: MetricLabels;
}) {
  const name = resolveMetricLabel(metric.metricId, tr);
  const source = resolveSourceLabel(metric.source, tr);
  const isValue = metric.value.state === "value";
  return (
    <Card className="flex flex-col justify-between gap-3 rounded-xl p-4" data-metric-id={metric.metricId}>
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-medium text-foreground">{name}</h4>
        {source ? <p className="text-xs text-muted-foreground">{source}</p> : null}
      </div>
      <p className={cn("text-2xl font-bold", isValue ? "text-foreground" : "text-base font-medium text-muted-foreground")}>
        {formatMetricValue(metric.value, locale, tr)}
      </p>
      {metric.comparison ? (
        <MetricComparison comparison={metric.comparison} labels={labels} locale={locale} tr={tr} />
      ) : null}
    </Card>
  );
}
