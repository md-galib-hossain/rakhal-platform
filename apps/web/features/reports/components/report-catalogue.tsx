"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormSheet } from "@/components/shared/form-sheet";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportCatalogue, useGenerateReport, useReportJob } from "../hooks/use-reports";
import type { ReportDef, ReportFormat } from "../types";

const CATEGORY_ORDER = ["production", "reproduction", "health", "financial", "combined"] as const;

export function ReportCatalogue() {
  const t = useTranslations("reports");
  const { data, isLoading, isError, refetch } = useReportCatalogue();
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorState description={t("catalogueError")} onRetry={() => void refetch()} />;
  }

  const groups = CATEGORY_ORDER.map((cat) => data.report_categories.find((g) => g.category === cat)).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.category} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t(`categories.${group.category}`)}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.reports.map((report) => (
              <div key={report.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                <p className="font-medium text-foreground">{report.name}</p>
                <p className="text-sm text-muted-foreground">{report.description}</p>
                <p className="text-xs text-muted-foreground">
                  {report.last_generated
                    ? t("lastGenerated", { date: new Date(report.last_generated).toLocaleDateString() })
                    : t("neverGenerated")}
                </p>
                <Button size="sm" className="mt-auto self-start" onClick={() => setActiveReport(report)}>
                  {t("generate")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {activeReport ? (
        <GenerateReportDialog report={activeReport} open onOpenChange={(next) => !next && setActiveReport(null)} />
      ) : null}
    </div>
  );
}

/** Just the fields this dialog reads — lets callers pass static report metadata (a fixed
 * `reportId`/`name`/`description`/`formats`/`params`) without fetching the full catalogue,
 * e.g. a page-level "Export" button that already knows which report it targets. */
export type GenerateReportDialogDef = Pick<ReportDef, "id" | "name" | "description" | "formats" | "params">;

export function GenerateReportDialog({
  report,
  open,
  onOpenChange,
  defaultParams,
}: {
  report: GenerateReportDialogDef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill (still-editable) param values, e.g. `{ cattleId }` from a cow profile page so the
   * caller doesn't have to retype an ID it already knows (RAKHAL-295-F). */
  defaultParams?: Record<string, string>;
}) {
  const t = useTranslations("reports");
  const generate = useGenerateReport();
  const [format, setFormat] = useState<ReportFormat>(report.formats[0]);
  const [params, setParams] = useState<Record<string, string>>(defaultParams ?? {});
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const job = useReportJob(jobId);

  async function onSubmit() {
    try {
      const result = await generate.mutateAsync({
        reportId: report.id,
        format,
        parameters: Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
      });
      setJobId(result.job_id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const settled = job.data?.status === "completed" || job.data?.status === "failed";

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={report.name}
      description={report.description}
      onSubmit={onSubmit}
      pending={generate.isPending || (Boolean(jobId) && !settled)}
      submitLabel={jobId ? t("regenerate") : t("generate")}
    >
      {!jobId ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{t("format")}</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {report.formats.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {report.params.map((param) => (
            <div key={param} className="flex flex-col gap-1.5">
              <Label>{t(`params.${param}`)}</Label>
              <Input
                type={param === "month" ? "month" : param === "year" ? "number" : /Date$/.test(param) || param === "date" ? "date" : "text"}
                value={params[param] ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, [param]: e.target.value }))}
              />
            </div>
          ))}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4">
          {!settled ? (
            <>
              <Badge variant="info">{t(`status.${job.data?.status ?? "queued"}`)}</Badge>
              <p className="text-sm text-muted-foreground">{t("generating")}</p>
            </>
          ) : job.data?.status === "completed" && job.data.download_url ? (
            <>
              <Badge variant="success">{t("status.completed")}</Badge>
              <a
                href={`/api/reports/jobs/${jobId}/download`}
                download
                className="text-sm font-medium text-primary underline"
              >
                {t("download")}
              </a>
            </>
          ) : (
            <>
              <Badge variant="destructive">{t("status.failed")}</Badge>
              <p className="text-sm text-muted-foreground">{job.data?.error}</p>
            </>
          )}
        </div>
      )}
    </FormSheet>
  );
}
