"use client"; // local "show all" toggle

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@rakhal/ui/ui/card";
import type { Locale } from "@/lib/constants/i18n";
import { formatNumber } from "@/lib/format";
import { formatMetricValue } from "../../lib/format";
import { humanizeMetricId, resolveMetricLabel, resolveSourceLabel, type ReportTranslator } from "../../lib/labels";
import type { BreakdownRow, MetricResult } from "../../types";
import { MetricComparison } from "./metric-comparison";
import type { MetricLabels } from "./metric-stat-card";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Rows beyond this are behind "Show all" (the backend already caps and sorts largest first; order is kept). */
export const ROWS_VISIBLE = 8;

/** A database id (cuid / uuid) as a row key means "an animal that no longer resolves", not a human word. */
const ID_LIKE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,})$/i;

export function rowLabel(row: BreakdownRow, removedLabel: string): string {
  if (row.label && row.label.trim()) return row.label;
  return ID_LIKE.test(row.key) ? removedLabel : humanizeMetricId(row.key);
}

/**
 * A ranked breakdown. One semantic table: label | bar | value. The bar is decoration (aria-hidden); the value text
 * carries the data. Rows whose value is not a number show their state words and no bar.
 */
export function MetricRowsCard({
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
  const [expanded, setExpanded] = useState(false);
  const rows = metric.rows ?? [];
  const visible = expanded ? rows : rows.slice(0, ROWS_VISIBLE);
  const name = resolveMetricLabel(metric.metricId, tr);
  const source = resolveSourceLabel(metric.source, tr);
  const max = rows.reduce((m, r) => (r.value.state === "value" && r.value.value > m ? r.value.value : m), 0);
  const removed = t("metric.animalRemoved");

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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <caption className="sr-only">{`${name} — ${t("metric.rows")}`}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t("metric.col.name")}</th>
              <th scope="col">{t("metric.col.value")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const isValue = row.value.state === "value" && Number.isFinite(row.value.value);
              const pct = isValue && max > 0 ? Math.max(2, Math.round(((row.value as { value: number }).value / max) * 100)) : 0;
              // A row basis that only repeats the metric's own basis is noise: show it when it differs.
              const rowSource = row.source && row.source !== metric.source ? resolveSourceLabel(row.source, tr) : null;
              return (
                <tr
                  key={`${row.key}-${i}`}
                  className="border-t border-border first:border-t-0 transition-colors hover:bg-muted/40"
                >
                  <th scope="row" className="w-2/5 max-w-0 py-2.5 pr-3 text-left align-middle font-medium text-foreground">
                    <span className="block truncate" title={rowLabel(row, removed)}>
                      {rowLabel(row, removed)}
                    </span>
                    {rowSource ? <span className="block truncate text-xs font-normal text-muted-foreground">{rowSource}</span> : null}
                  </th>
                  <td className="py-2.5 pr-3 align-middle" aria-hidden>
                    {isValue ? (
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right align-middle tabular-nums font-semibold text-foreground">
                    {formatMetricValue(row.value, locale, tr)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">{t("metric.noRows")}</p> : null}
      {rows.length > ROWS_VISIBLE ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? t("metric.showFewer") : t("metric.showAll", { count: formatNumber(rows.length, locale) })}
        </Button>
      ) : null}
    </Card>
  );
}
