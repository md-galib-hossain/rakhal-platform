"use client"; // translators + retry mutation

import { AlertTriangle, Check, FileQuestion, Loader2, Lock, RefreshCw } from "lucide-react";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Button } from "@rakhal/ui/ui/button";
import { Card } from "@rakhal/ui/ui/card";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRetryReport } from "../../hooks/use-retry-report";
import { isReportApiError, reportErrorCategoryKey, reportErrorKeyFor } from "../../lib/errors";
import type { ReportDetail } from "../../types";
import { BackToReports } from "./report-header";
import { useReportI18n } from "./use-report-i18n";

/** Page-shaped skeleton: header + meta strip + a few cards. Also used by `loading.tsx` (via the server-safe copy there). */
export function ReportDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}

function MessageState({
  icon: Icon,
  tone = "muted",
  title,
  body,
  children,
}: {
  icon: typeof FileQuestion;
  tone?: "muted" | "destructive";
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className={cn("flex size-12 items-center justify-center rounded-full", tone === "destructive" ? "bg-destructive-tint" : "bg-muted")}>
        <Icon className={cn("size-6", tone === "destructive" ? "text-destructive" : "text-muted-foreground")} aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {body ? <p className="max-w-md text-sm text-muted-foreground">{body}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
    </div>
  );
}

/** Unknown, other-farm and finance-hidden reports are all 404 and read identically (no existence leak). */
export function ReportNotFoundState() {
  const { t } = useReportI18n();
  return (
    <MessageState icon={FileQuestion} title={t("notFound.title")} body={t("notFound.body")}>
      <BackToReports />
    </MessageState>
  );
}

export function ReportNoAccessState() {
  const { t } = useReportI18n();
  return (
    <MessageState icon={Lock} title={t("noAccess.title")} body={t("noAccess.body")}>
      <BackToReports />
    </MessageState>
  );
}

export function ReportLoadErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t, tr } = useReportI18n();
  return (
    <div className="flex flex-col items-center gap-3">
      <ErrorState title={t("loadError.title")} description={tr(reportErrorKeyFor(error))} onRetry={onRetry} />
      <BackToReports />
    </div>
  );
}

const STEPS = ["stepQueued", "stepProcessing", "stepReady"] as const;

/** QUEUED / PROCESSING. The title is a polite live region; the layout is fixed so polling never flickers it. */
export function ReportPendingState({
  status,
  timedOut,
  onRefresh,
  refreshing,
}: {
  status: "QUEUED" | "PROCESSING";
  timedOut: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { t } = useReportI18n();
  const active = status === "QUEUED" ? 0 : 1;
  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl p-6 text-center sm:p-8">
      {timedOut ? (
        <>
          <AlertTriangle className="size-8 text-warning" aria-hidden />
          <div role="status" className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-foreground">{t("pending.timedOutTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("pending.timedOutBody")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn(refreshing && "animate-spin motion-reduce:animate-none")} aria-hidden />
              {t("actions.refresh")}
            </Button>
            <BackToReports />
          </div>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
          <div role="status" aria-live="polite" className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-foreground">
              {status === "QUEUED" ? t("pending.queuedTitle") : t("pending.processingTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("pending.hint")}</p>
          </div>
          <ol className="flex w-full items-center justify-center gap-2 text-xs sm:gap-3">
            {STEPS.map((step, i) => (
              <li
                key={step}
                aria-current={i === active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                  i < active && "bg-success-tint text-success",
                  i === active && "bg-info-tint text-info",
                  i > active && "bg-muted text-muted-foreground",
                )}
              >
                {i < active ? <Check className="size-3.5" aria-hidden /> : null}
                {t(`pending.${step}`)}
              </li>
            ))}
          </ol>
          <BackToReports />
        </>
      )}
    </Card>
  );
}

/** FAILED: a safe message by `errorCategory` (never the raw backend text), Retry, back. */
export function ReportFailedState({ report }: { report: ReportDetail }) {
  const { t, tr } = useReportI18n();
  const retry = useRetryReport();
  const limitReached = retry.isError && isReportApiError(retry.error) && retry.error.reason === "REPORT_RETRY_LIMIT";
  const canTryAgain = !limitReached;

  return (
    <MessageState icon={AlertTriangle} tone="destructive" title={t("failed.title")} body={tr(reportErrorCategoryKey(report.errorCategory))}>
      {retry.isError ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {tr(reportErrorKeyFor(retry.error))}
        </p>
      ) : (
        <p className="w-full text-xs text-muted-foreground">{t("failed.retriesHint")}</p>
      )}
      {canTryAgain ? (
        <Button onClick={() => retry.mutate(report.id)} disabled={retry.isPending} aria-busy={retry.isPending}>
          <RefreshCw className={cn(retry.isPending && "animate-spin motion-reduce:animate-none")} aria-hidden />
          {retry.isPending ? t("actions.retrying") : t("actions.retry")}
        </Button>
      ) : null}
      <BackToReports />
    </MessageState>
  );
}
