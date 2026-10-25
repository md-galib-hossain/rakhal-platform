"use client";

import { useMutation } from "@tanstack/react-query";
import { reportsApi } from "../api";
import type { PreviewReportRequest } from "../types";

/**
 * `POST /reports/preview` — computes the snapshot live, nothing is stored. Throttled (3/min) and one at a time
 * per farm, so call `mutate` on an explicit "Preview" click, never on every form change. `data` is a full
 * `ReportSnapshotPayload`. Errors are `ReportApiError` (`REPORT_PREVIEW_BUSY` = try again shortly).
 */
export function usePreviewReport() {
  return useMutation({
    mutationFn: (request: PreviewReportRequest) => reportsApi.preview(request),
  });
}
