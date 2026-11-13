"use client"; // list query + download mutation

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarClock, CalendarDays, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { reportErrorKeyFor, useDownloadReport, useReportsInfinite, type ReportSummary } from "@/features/reports";
import { ReportStatusBadge } from "../history/report-status-badge";
import { useReportLabels } from "../history/use-report-labels";
import { useReportsListPolling } from "../history/use-reports-list-polling";

type ScheduledKind = "WEEKLY" | "MONTHLY";

function LatestBody({ report }: { report: ReportSummary }) {
  const t = useTranslations();
  const tl = useTranslations("reportsLanding");
  const labels = useReportLabels();
  const download = useDownloadReport();
  const g = labels.generatedAt(report);
  const canDownload = report.status === "COMPLETED" && report.hasPdf;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-base font-semibold text-foreground">{labels.period(report)}</p>
        <ReportStatusBadge status={report.status} label={labels.status(report)} />
      </div>
      <p className="text-sm text-muted-foreground">
        <time dateTime={g.iso} title={g.absolute}>
          {tl(report.status === "COMPLETED" ? "card.generated" : "card.requested", { when: g.relative })}
        </time>
      </p>
      {report.status === "FAILED" ? (
        <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
          {labels.failure(report)}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button asChild variant={canDownload ? "outline" : "secondary"} size="sm">
          <Link href={`/reports/${encodeURIComponent(report.id)}`}>
            <ExternalLink aria-hidden />
            {tl("actions.open")}
          </Link>
        </Button>
        {canDownload ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={download.isPending}
            onClick={() =>
              download.mutate(report.id, { onError: (error) => toast.error(t(reportErrorKeyFor(error))) })
            }
          >
            {download.isPending ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Download aria-hidden />
            )}
            {t("reports.actions.download")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The newest scheduled (automatic) report of one kind. There is no "next run" shown on purpose: the backend exposes no
 * endpoint for it, so the empty state only says when reports are created, never a date we would have to invent.
 */
export function ScheduledReportCard({ kind }: { kind: ScheduledKind }) {
  const t = useTranslations();
  const tl = useTranslations("reportsLanding");
  const query = useReportsInfinite({ origin: "SCHEDULED", type: kind }, { pageSize: 1 });
  const latest = query.items[0];
  useReportsListPolling(latest ? [latest] : [], query.refetch);

  const Icon = kind === "WEEKLY" ? CalendarDays : CalendarClock;
  const headingId = `scheduled-${kind.toLowerCase()}-title`;

  let content: React.ReactNode;
  if (query.isLoading) {
    content = (
      <div className="flex flex-col gap-3" role="status" aria-busy="true">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">{tl("card.error")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {tl("retry")}
        </Button>
      </div>
    );
  } else if (!latest) {
    content = <p className="text-sm text-muted-foreground">{tl(`card.empty.${kind}`)}</p>;
  } else {
    content = <LatestBody report={latest} />;
  }

  return (
    <section aria-labelledby={headingId} className="flex min-h-40 flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-muted">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <div className="flex flex-col">
          <h2 id={headingId} className="text-sm font-semibold text-foreground">
            {tl(`card.title.${kind}`)}
          </h2>
          <p className="text-xs text-muted-foreground">{t(`reports.origin.SCHEDULED`)}</p>
        </div>
      </div>
      {content}
    </section>
  );
}
