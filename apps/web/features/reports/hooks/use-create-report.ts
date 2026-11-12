"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reportsApi } from "../api";
import { toCreateResult } from "../lib/create-result";
import { createIdempotencyKeyStore } from "../lib/idempotency";
import type { CreateReportRequest, CreateReportResult, ReportDetail } from "../types";

/**
 * `POST /reports`. Resolves with a typed result:
 * - `{kind:'created', report, replayed}` — a new report (or the same Idempotency-Key answered again);
 * - `{kind:'duplicate', existing}`       — an identical report already exists (HTTP 200): offer "open existing"
 *   or resubmit with `forceNew: true`.
 *
 * An `Idempotency-Key` is generated per submitted form attempt and reused while the identical payload is retried
 * after a failure (so a network drop can never create two reports); it is dropped once the attempt resolves.
 * Errors are `ReportApiError` (`REPORT_TOO_MANY_IN_FLIGHT`, `REPORT_FINANCE_FORBIDDEN`, …).
 */
export function useCreateReport() {
  const queryClient = useQueryClient();
  const keys = useRef<ReturnType<typeof createIdempotencyKeyStore>>(null);
  if (keys.current === null) keys.current = createIdempotencyKeyStore();
  const store = keys.current;

  return useMutation<CreateReportResult, Error, CreateReportRequest>({
    mutationFn: async (request) => toCreateResult(await reportsApi.create(request, store.keyFor(request))),
    onSuccess: (result) => {
      store.settle();
      const row = result.kind === "created" ? result.report : result.existing;
      // Seed the detail cache (no payload yet) so the detail page can render instantly, then refresh the history.
      const seeded: ReportDetail = { ...row, payload: null };
      queryClient.setQueryData<ReportDetail>(qk.reports.detail(row.id), (old) => old ?? seeded);
      void queryClient.invalidateQueries({ queryKey: qk.reports.listAll() });
    },
  });
}
