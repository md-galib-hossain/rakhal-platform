"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/auth/permissions";
import {
  useReportSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  useReportCatalogue,
} from "../hooks/use-reports";
import { createScheduleSchema, type CreateScheduleInput } from "../schemas";
import type { ReportFormat, ReportScheduleFrequency } from "../types";

export function SchedulesPanel() {
  const t = useTranslations("reports");
  const { data, isLoading, isError, refetch } = useReportSchedules();
  const catalogue = useReportCatalogue();
  const deleteSchedule = useDeleteSchedule();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reportName = (reportId: string) =>
    catalogue.data?.report_categories.flatMap((g) => g.reports).find((r) => r.id === reportId)?.name ?? reportId;

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }
  if (isError || !data) {
    return <ErrorState description={t("schedulesError")} onRetry={() => void refetch()} />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{t("schedules.title")}</h2>
        <Can I="reports.schedule">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> {t("schedules.new")}
          </Button>
        </Can>
      </div>
      {data.schedules.length === 0 ? (
        <EmptyState title={t("schedules.empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {data.schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">{reportName(s.report_id)}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{s.format.toUpperCase()}</Badge>
                  <Badge variant="secondary">{t(`schedules.frequency.${s.frequency}`)}</Badge>
                  <span>{t("schedules.nextRun", { date: new Date(s.next_run_at).toLocaleString() })}</span>
                </div>
              </div>
              <Can I="reports.schedule">
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)} aria-label={t("schedules.delete")}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </Can>
            </div>
          ))}
        </div>
      )}
      <CreateScheduleDialog open={createOpen} onOpenChange={setCreateOpen} reportOptions={catalogue.data} />
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(next) => !next && setDeleteId(null)}
        title={t("schedules.deleteConfirmTitle")}
        description={t("schedules.deleteConfirmDescription")}
        confirmLabel={t("schedules.delete")}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await deleteSchedule.mutateAsync(deleteId);
            toast.success(t("schedules.deletedToast"));
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : t("genericError"));
          }
        }}
      />
    </div>
  );
}

function defaults(): CreateScheduleInput {
  return { reportId: "", format: "csv", frequency: "daily" };
}

function CreateScheduleDialog({
  open,
  onOpenChange,
  reportOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportOptions: ReturnType<typeof useReportCatalogue>["data"];
}) {
  const t = useTranslations("reports");
  const createSchedule = useCreateSchedule();
  const form = useForm<CreateScheduleInput>({ resolver: zodResolver(createScheduleSchema), defaultValues: defaults() });
  const frequency = form.watch("frequency");
  const allReports = reportOptions?.report_categories.flatMap((g) => g.reports) ?? [];

  async function onSubmit(values: CreateScheduleInput) {
    try {
      await createSchedule.mutateAsync(values);
      toast.success(t("schedules.createdToast"));
      form.reset(defaults());
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset(defaults());
        onOpenChange(next);
      }}
      title={t("schedules.new")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={createSchedule.isPending}
      submitLabel={t("schedules.create")}
    >
      <div className="flex flex-col gap-1.5">
        <Label>{t("schedules.report")}</Label>
        <Select value={form.watch("reportId")} onValueChange={(v) => form.setValue("reportId", v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("schedules.reportPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {allReports.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.reportId ? (
          <p className="text-xs text-destructive">{form.formState.errors.reportId.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("format")}</Label>
        <Select value={form.watch("format")} onValueChange={(v) => form.setValue("format", v as ReportFormat)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("schedules.frequencyLabel")}</Label>
        <Select
          value={frequency}
          onValueChange={(v) => form.setValue("frequency", v as ReportScheduleFrequency)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t("schedules.frequency.daily")}</SelectItem>
            <SelectItem value="weekly">{t("schedules.frequency.weekly")}</SelectItem>
            <SelectItem value="monthly">{t("schedules.frequency.monthly")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {frequency === "weekly" ? (
        <div className="flex flex-col gap-1.5">
          <Label>{t("schedules.dayOfWeek")}</Label>
          <Input type="number" min={1} max={7} {...form.register("dayOfWeek", { valueAsNumber: true })} />
          {form.formState.errors.dayOfWeek ? (
            <p className="text-xs text-destructive">{form.formState.errors.dayOfWeek.message}</p>
          ) : null}
        </div>
      ) : null}
      {frequency === "monthly" ? (
        <div className="flex flex-col gap-1.5">
          <Label>{t("schedules.dayOfMonth")}</Label>
          <Input type="number" min={1} max={28} {...form.register("dayOfMonth", { valueAsNumber: true })} />
          {form.formState.errors.dayOfMonth ? (
            <p className="text-xs text-destructive">{form.formState.errors.dayOfMonth.message}</p>
          ) : null}
        </div>
      ) : null}
    </FormDialog>
  );
}
