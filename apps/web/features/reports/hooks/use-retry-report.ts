"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reportsApi } from "../api";
import type { ReportDetail } from "../types";

/**
 * `POST /reports/:id/retry` — FAILED -> QUEUED (max 3 manual retries). Patches the cached detail with the fresh
 * summary (status back to QUEUED so `useReport` resumes polling) and refreshes the history.
 * Errors: `REPORT_NOT_RETRYABLE`, `REPORT_RETRY_LIMIT`, `REPORT_QUEUE_UNAVAILABLE`.
 */
export function useRetryReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.retry(id),
    onSuccess: (summary) => {
      queryClient.setQueryData<ReportDetail>(qk.reports.detail(summary.id), (old) =>
        old ? { ...old, ...summary, payload: null } : { ...summary, payload: null },
      );
      void queryClient.invalidateQueries({ queryKey: qk.reports.detail(summary.id) });
      void queryClient.invalidateQueries({ queryKey: qk.reports.listAll() });
    },
  });
}
