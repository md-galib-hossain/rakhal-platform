"use client"; // download/delete mutations + confirm dialog

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@rakhal/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import { formatDate, formatDateTime } from "@/lib/format";
import { useDeleteReport } from "../../hooks/use-delete-report";
import { useDownloadReport } from "../../hooks/use-download-report";
import { periodLabel } from "../../lib/format";
import { reportErrorKeyFor } from "../../lib/errors";
import { reportOriginKey, reportStatusKey } from "../../lib/labels";
import type { ReportDetail, ReportSnapshotPayload } from "../../types";
import { ReportStatusBadge } from "../history/report-status-badge";
import { useReportI18n } from "./use-report-i18n";

export const REPORTS_LIST_HREF = "/reports";

function ymdToDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Back link used by every state of the page. */
export function BackToReports() {
  const { t } = useReportI18n();
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={REPORTS_LIST_HREF}>
        <ArrowLeft aria-hidden />
        {t("back")}
      </Link>
    </Button>
  );
}

export function ReportHeader({
  report,
  payload,
  canDelete,
}: {
  report: ReportDetail;
  payload: ReportSnapshotPayload;
  canDelete: boolean;
}) {
  const { t, tr, locale } = useReportI18n();
  const router = useRouter();
  const download = useDownloadReport();
  const remove = useDeleteReport();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const type = payload.reportType ?? report.type;
  const scope = payload.scope;
  const scopeText =
    scope.kind === "ALL_ELIGIBLE"
      ? t("meta.scopeAll")
      : scope.kind === "SINGLE_COW"
        ? t("meta.scopeCow")
        : t("meta.scopeGroup", {
            date: (() => {
              const d = ymdToDate(scope.membershipAsOf) ?? new Date(scope.membershipAsOf);
              return Number.isNaN(d.getTime()) ? scope.membershipAsOf : formatDate(d, locale);
            })(),
          });
  const generatedAt = formatDateTime(payload.generatedAt, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: payload.farm.timezone || undefined,
  });

  const onDownload = () =>
    download.mutate(report.id, {
      onSuccess: () => toast.success(t("actions.downloadStarted")),
      onError: (e) => toast.error(tr(reportErrorKeyFor(e))),
    });

  const onDelete = async () => {
    try {
      await remove.mutateAsync(report.id);
      toast.success(t("actions.deleted"));
      router.push(REPORTS_LIST_HREF);
    } catch (e) {
      toast.error(tr(reportErrorKeyFor(e)));
    }
  };

  const meta: { label: string; value: string }[] = [
    { label: t("meta.period"), value: periodLabel(payload.period, locale) },
    ...(payload.previousPeriod ? [{ label: t("meta.comparedWith"), value: periodLabel(payload.previousPeriod, locale) }] : []),
    { label: t("meta.farm"), value: payload.farm.name },
    { label: t("meta.scope"), value: scopeText },
    { label: t("meta.generatedAt"), value: generatedAt },
    { label: t("meta.origin"), value: tr(reportOriginKey(report.origin)) },
  ];

  return (
    <header className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <BackToReports />
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t(`type.${type}`)}</h1>
            <ReportStatusBadge status={report.status} label={tr(reportStatusKey(report.status))} />
            <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {tr(reportOriginKey(report.origin))}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {report.hasPdf ? (
            <Button
              onClick={onDownload}
              disabled={download.isPending}
              aria-busy={download.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-medium transition-all"
            >
              {download.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Download className="size-4" aria-hidden />}
              {download.isPending ? t("actions.downloading") : t("actions.download")}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                  className="cursor-not-allowed opacity-50 bg-primary text-primary-foreground font-medium shadow-sm"
                >
                  <Download className="size-4" aria-hidden />
                  {t("actions.download")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("actions.noPdf")}</TooltipContent>
            </Tooltip>
          )}
          {canDelete ? (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} className="shadow-sm font-medium">
              <Trash2 className="size-4" aria-hidden />
              {t("actions.delete")}
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {meta.map((m) => (
          <div key={m.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</dt>
            <dd className="break-words text-sm font-bold text-foreground">{m.value}</dd>
          </div>
        ))}
      </dl>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("actions.deleteTitle")}
        description={t("actions.deleteDescription")}
        confirmLabel={t("actions.deleteConfirm")}
        cancelLabel={tr("reports.actions.cancel")}
        onConfirm={onDelete}
      />
    </header>
  );
}
