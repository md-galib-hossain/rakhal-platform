"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reportsApi } from "../api";
import type { GenerateReportInput, CreateScheduleInput } from "../schemas";

export function useReportCatalogue() {
  return useQuery({
    queryKey: qk.reports.catalogue(),
    queryFn: () => reportsApi.catalogue(),
    staleTime: 10_000,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: GenerateReportInput) => reportsApi.generate(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.reports.catalogue() }),
  });
}

/** Polls `GET /reports/jobs/:id` every 1.5s while the job is `queued`/`generating` — the backend
 * runs generation off a BullMQ worker (RD-013a), so there's no synchronous response to wait on. */
export function useReportJob(jobId: string | undefined) {
  return useQuery({
    queryKey: qk.reports.job(jobId ?? ""),
    queryFn: () => reportsApi.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1500;
    },
  });
}

export function useReportSchedules() {
  return useQuery({
    queryKey: qk.reports.schedules(),
    queryFn: () => reportsApi.listSchedules(),
    staleTime: 10_000,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateScheduleInput) => reportsApi.createSchedule(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.reports.schedules() }),
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.deleteSchedule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.reports.schedules() }),
  });
}
