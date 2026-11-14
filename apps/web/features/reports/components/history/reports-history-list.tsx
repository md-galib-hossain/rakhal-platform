"use client"; // row actions are interactive; labels read the locale

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@rakhal/ui/ui/badge";
import { MobileRecordCard } from "@rakhal/ui/shared/mobile-record-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import type { ReportSummary } from "@/features/reports";
import { ReportActions } from "./report-actions";
import { ReportStatusBadge } from "./report-status-badge";
import { useReportLabels } from "./use-report-labels";

export interface ReportsHistoryListProps {
  items: ReportSummary[];
  canRetry: boolean;
  canDelete: boolean;
}

/** One `<time>` with the relative text visible and the exact moment in the tooltip + machine-readable value. */
function GeneratedAt({ report }: { report: ReportSummary }) {
  const labels = useReportLabels();
  const g = labels.generatedAt(report);
  return (
    <time dateTime={g.iso} title={g.absolute} className="flex flex-col">
      <span className="text-sm text-foreground">{g.relative}</span>
      <span className="text-xs text-muted-foreground">{g.absolute}</span>
    </time>
  );
}

function OriginBadge({ report }: { report: ReportSummary }) {
  const labels = useReportLabels();
  return <Badge variant={report.origin === "SCHEDULED" ? "outline" : "secondary"}>{labels.origin(report)}</Badge>;
}

/**
 * History rows: a table when the content area is at least 48rem wide, cards below. This is a container query, not a viewport
 * one: the sidebar takes ~250px, so at a 768px viewport the content is far too narrow for five columns. Both layouts are
 * rendered and switched with CSS (same approach as `DataTable`), so there is no layout flash and no JS breakpoint state. Presentation only; the container owns data, filters and polling.
 */
export function ReportsHistoryList({ items, canRetry, canDelete }: ReportsHistoryListProps) {
  const t = useTranslations("reportsLanding");
  const labels = useReportLabels();

  return (
    <div className="@container">
      <div className="hidden overflow-x-auto @3xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("history.columns.report")}</TableHead>
              <TableHead>{t("history.columns.origin")}</TableHead>
              <TableHead>{t("history.columns.status")}</TableHead>
              <TableHead>{t("history.columns.generated")}</TableHead>
              <TableHead className="text-right">{t("history.columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="max-w-[18rem]">
                  <Link
                    href={`/reports/${encodeURIComponent(report.id)}`}
                    className="flex flex-col rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-sm font-medium text-foreground hover:underline">{labels.type(report)}</span>
                    <span className="text-xs text-muted-foreground">{labels.period(report)}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <OriginBadge report={report} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <ReportStatusBadge status={report.status} label={labels.status(report)} />
                    {report.status === "FAILED" ? (
                      <span className="max-w-[14rem] text-xs text-muted-foreground">{labels.failure(report)}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <GeneratedAt report={report} />
                </TableCell>
                <TableCell>
                  <ReportActions report={report} canRetry={canRetry} canDelete={canDelete} layout="icon" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 @3xl:hidden" aria-label={t("history.title")}>
        {items.map((report) => (
          <li key={report.id}>
            <MobileRecordCard
              title={labels.type(report)}
              subtitle={labels.period(report)}
              trailing={<ReportStatusBadge status={report.status} label={labels.status(report)} />}
              badges={<OriginBadge report={report} />}
              fields={[
                { label: t("history.columns.generated"), value: labels.generatedAt(report).relative },
                ...(report.status === "FAILED" ? [{ label: t("history.columns.status"), value: labels.failure(report) }] : []),
              ]}
              actions={<ReportActions report={report} canRetry={canRetry} canDelete={canDelete} layout="text" />}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
