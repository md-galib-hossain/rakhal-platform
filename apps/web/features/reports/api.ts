"use client";

import { apiFetch } from "@/lib/api/client";
import type { ReportCatalogue, ReportJob, ReportSchedule, GenerateReportResult } from "./types";
import type { GenerateReportInput, CreateScheduleInput } from "./schemas";

/** `/reports*` — real backend routes (`reports.controller.ts`), `reports.read`/`.create`/`.schedule`-gated,
 * plus a `reports.generate`/`reports.scheduled` subscription-feature gate (Pro tier). Generation is
 * async (RD-013a): `generate()` only enqueues the job — poll `getJob` until `status` settles. The
 * download itself doesn't go through this file's `apiFetch` (JSON envelope only) — see
 * `app/api/reports/jobs/[id]/download/route.ts` for the raw-bytes proxy, linked to directly as an
 * `<a href>` from the UI. */
export const reportsApi = {
  catalogue(): Promise<ReportCatalogue> {
    return apiFetch<ReportCatalogue>("/reports");
  },
  generate(dto: GenerateReportInput): Promise<GenerateReportResult> {
    return apiFetch<GenerateReportResult>("/reports/generate", { method: "POST", body: dto });
  },
  getJob(jobId: string): Promise<ReportJob> {
    return apiFetch<ReportJob>(`/reports/jobs/${jobId}`);
  },
  listSchedules(): Promise<{ schedules: ReportSchedule[] }> {
    return apiFetch<{ schedules: ReportSchedule[] }>("/reports/schedules");
  },
  createSchedule(dto: CreateScheduleInput): Promise<ReportSchedule> {
    return apiFetch<ReportSchedule>("/reports/schedules", { method: "POST", body: dto });
  },
  deleteSchedule(id: string): Promise<void> {
    return apiFetch<void>(`/reports/schedules/${id}`, { method: "DELETE" });
  },
};
