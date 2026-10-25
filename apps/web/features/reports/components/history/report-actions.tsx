"use client"; // mutations (download / retry / delete), confirm state, toasts

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Download, ExternalLink, Loader2, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  reportErrorKeyFor,
  useDeleteReport,
  useDownloadReport,
  useRetryReport,
  type ReportSummary,
} from "@/features/reports";

export interface ReportActionsProps {
  report: ReportSummary;
  /** `reports.create`: retry. */
  canRetry: boolean;
  /** `reports.delete`: the delete control is not rendered at all without it. */
  canDelete: boolean;
  /** "icon" = compact icon buttons with tooltips (table); "text" = labelled buttons (cards). */
  layout: "icon" | "text";
  className?: string;
}

/** Why the PDF button is inactive, as a `reportsLanding.download.*` key. */
function downloadBlockedKey(report: ReportSummary): string | null {
  if (report.status === "QUEUED" || report.status === "PROCESSING") return "notReady";
  if (report.status === "FAILED") return "failed";
  if (!report.hasPdf) return "noPdf";
  return null;
}

/**
 * Row/card actions: Open (always), Download PDF (COMPLETED + hasPdf, otherwise inactive with a reason), Retry (FAILED
 * only), Delete (only when permitted, behind a confirm). Backend refusals (`REPORT_OWNER_ONLY`, `REPORT_PROCESSING`, retry
 * limits...) are mapped through `reportErrorKeyFor` so the toast is always in the active locale.
 */
export function ReportActions({ report, canRetry, canDelete, layout, className }: ReportActionsProps) {
  const t = useTranslations();
  const tl = useTranslations("reportsLanding");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const download = useDownloadReport();
  const retry = useRetryReport();
  const remove = useDeleteReport();

  const blockedKey = downloadBlockedKey(report);
  const openLabel = tl("actions.open");
  const downloadLabel = t("reports.actions.download");
  const retryLabel = t("reports.actions.retry");
  const deleteLabel = t("reports.actions.delete");

  const onDownload = () => {
    if (blockedKey || download.isPending) return;
    download.mutate(report.id, { onError: (error) => toast.error(t(reportErrorKeyFor(error))) });
  };
  const onRetry = () => {
    if (retry.isPending) return;
    retry.mutate(report.id, {
      onSuccess: () => toast.success(tl("toast.retried")),
      onError: (error) => toast.error(t(reportErrorKeyFor(error))),
    });
  };
  const onDelete = async () => {
    try {
      await remove.mutateAsync(report.id);
      toast.success(tl("toast.deleted"));
    } catch (error) {
      toast.error(t(reportErrorKeyFor(error)));
    }
  };

  const icon = layout === "icon";
  const size = icon ? "icon" : "sm";
  const iconBtn = "size-8 pointer-coarse:size-11";
  const wrap = (label: string, node: React.ReactNode, tip?: string) =>
    icon ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent>{tip ?? label}</TooltipContent>
      </Tooltip>
    ) : (
      node
    );

  const downloadIcon = download.isPending ? (
    <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
  ) : (
    <Download aria-hidden />
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-wrap items-center gap-1.5", icon && "justify-end gap-1", className)}>
        {wrap(
          openLabel,
          <Button asChild variant={icon ? "ghost" : "outline"} size={size} className={icon ? iconBtn : undefined}>
            <Link href={`/reports/${encodeURIComponent(report.id)}`} aria-label={icon ? openLabel : undefined}>
              <ExternalLink aria-hidden />
              {icon ? null : openLabel}
            </Link>
          </Button>,
        )}

        {wrap(
          downloadLabel,
          <Button
            type="button"
            variant={icon ? "ghost" : "outline"}
            size={size}
            className={cn(icon && iconBtn, blockedKey && "cursor-not-allowed opacity-50")}
            aria-label={icon ? downloadLabel : undefined}
            aria-disabled={blockedKey ? true : undefined}
            title={!icon && blockedKey ? tl(`download.${blockedKey}`) : undefined}
            onClick={onDownload}
          >
            {downloadIcon}
            {icon ? null : downloadLabel}
          </Button>,
          blockedKey ? tl(`download.${blockedKey}`) : downloadLabel,
        )}

        {report.status === "FAILED" && canRetry
          ? wrap(
              retryLabel,
              <Button
                type="button"
                variant={icon ? "ghost" : "outline"}
                size={size}
                className={icon ? iconBtn : undefined}
                aria-label={icon ? retryLabel : undefined}
                disabled={retry.isPending}
                onClick={onRetry}
              >
                {retry.isPending ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <RotateCw aria-hidden />
                )}
                {icon ? null : retryLabel}
              </Button>,
            )
          : null}

        {canDelete
          ? wrap(
              deleteLabel,
              <Button
                type="button"
                variant={icon ? "ghost" : "destructive"}
                size={size}
                className={cn(icon && iconBtn, icon && "text-destructive hover:bg-destructive-tint")}
                aria-label={icon ? deleteLabel : undefined}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 aria-hidden />
                {icon ? null : deleteLabel}
              </Button>,
            )
          : null}
      </div>

      {canDelete && confirmOpen ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={tl("delete.title")}
          description={tl("delete.description")}
          confirmLabel={deleteLabel}
          cancelLabel={t("reports.actions.cancel")}
          onConfirm={onDelete}
        />
      ) : null}
    </TooltipProvider>
  );
}
