"use client"; // composes client-side cards that use the translators

import { Lock } from "lucide-react";
import { Card } from "@rakhal/ui/ui/card";
import { resolveBackendKey } from "../../lib/labels";
import type { MetricResult, ReportSnapshotPayload } from "../../types";
import { DataQualityBox } from "./data-quality-box";
import { ExceptionsList } from "./exceptions-list";
import { MetricRowsCard } from "./metric-rows-card";
import { MetricSeriesCard } from "./metric-series-card";
import { MetricStatCard } from "./metric-stat-card";
import { useReportI18n } from "./use-report-i18n";

export type MetricKind = "series" | "rows" | "scalar";

/** Which card a metric gets: a non-empty series is a chart, non-empty rows a ranked breakdown, anything else a stat. */
export function metricKind(metric: MetricResult): MetricKind {
  if (metric.series && metric.series.length > 0) return "series";
  if (metric.rows && metric.rows.length > 0) return "rows";
  return "scalar";
}

/**
 * The completed report, rendered from the snapshot only (no maths here). Sections keep the payload order.
 * The restricted-finance notice shows only when the report has no finance AND the viewer could have seen it.
 */
export function ReportBody({ payload, canViewFinance }: { payload: ReportSnapshotPayload; canViewFinance: boolean }) {
  const { t, tr, locale } = useReportI18n();
  const labels = { previous: t("metric.previous"), vsPrevious: t("metric.vsPrevious") };

  return (
    <div className="flex flex-col gap-6">
      {!payload.includesFinance && canViewFinance ? (
        <Card role="note" className="flex items-start gap-3 rounded-xl border-dashed p-4" data-testid="finance-notice">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">{t("finance.title")}</p>
            <p className="text-sm text-muted-foreground">{t("finance.body")}</p>
          </div>
        </Card>
      ) : null}

      {payload.sections.map((section, si) => {
        const titleId = `report-section-${si}`;
        return (
          <section key={`${section.id}-${si}`} aria-labelledby={titleId} className="flex flex-col gap-3" data-section-id={section.id}>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {resolveBackendKey(section.titleKey, tr)}
            </h2>
            {section.metrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("section.empty")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.metrics.map((metric, mi) => {
                  const key = `${metric.metricId}-${mi}`;
                  switch (metricKind(metric)) {
                    case "series":
                      return <MetricSeriesCard key={key} metric={metric} locale={locale} tr={tr} t={t} labels={labels} />;
                    case "rows":
                      return <MetricRowsCard key={key} metric={metric} locale={locale} tr={tr} t={t} labels={labels} />;
                    default:
                      return <MetricStatCard key={key} metric={metric} locale={locale} tr={tr} labels={labels} />;
                  }
                })}
              </div>
            )}
          </section>
        );
      })}

      <ExceptionsList exceptions={payload.exceptions} tr={tr} t={t} />
      <DataQualityBox dataQuality={payload.dataQuality} locale={locale} tr={tr} t={t} />
    </div>
  );
}
