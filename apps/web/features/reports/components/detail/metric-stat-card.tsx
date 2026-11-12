import { Activity, Baby, Milk, PawPrint, Stethoscope, Wallet, Wheat, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/constants/i18n";
import { cn } from "@/lib/utils";
import { formatMetricValue } from "../../lib/format";
import { resolveMetricLabel, resolveSourceLabel, type ReportTranslator } from "../../lib/labels";
import type { MetricResult, ReportDomain } from "../../types";
import { MetricComparison } from "./metric-comparison";

export interface MetricLabels {
  previous: string;
  vsPrevious: string;
}

const DOMAIN_ICON: Record<ReportDomain, LucideIcon> = {
  milk: Milk,
  health: Stethoscope,
  reproduction: Baby,
  feed: Wheat,
  finance: Wallet,
  cow_profile: PawPrint,
};

/** A plain function (not a component) so the icon is looked up from the static map, never created during render. */
function renderDomainIcon(metricId: string) {
  const prefix = metricId.split(".")[0] as ReportDomain;
  const Icon = DOMAIN_ICON[prefix] ?? Activity;
  return <Icon className="size-4.5" aria-hidden />;
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
    <Card
      className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-card hover:border-primary/40 hover:shadow-md transition-all duration-200"
      data-metric-id={metric.metricId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-sm font-medium text-foreground">{name}</h4>
          {source ? <p className="text-xs text-muted-foreground">{source}</p> : null}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {renderDomainIcon(metric.metricId)}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <p className={cn(isValue ? "text-3xl font-extrabold tracking-tight tabular-nums text-foreground" : "text-base font-medium text-muted-foreground")}>
          {formatMetricValue(metric.value, locale, tr)}
        </p>

        {metric.comparison ? (
          <>
            <div className="border-t border-border/60" />
            <MetricComparison comparison={metric.comparison} labels={labels} locale={locale} tr={tr} />
          </>
        ) : null}
      </div>
    </Card>
  );
}

