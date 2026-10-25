"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import { unwrapEnvelope } from "@/lib/api/envelope";
import { NetworkError } from "@/lib/api/errors";
import type { ApiEnvelope, CursorPage } from "@/types/api";
import { toReportApiError } from "./lib/errors";
import { fallbackReportFilename, parseContentDispositionFilename } from "./lib/filename";
import type {
  CreateReportRequest,
  CreateReportResponse,
  PreviewReportRequest,
  ReportDetail,
  ReportDownload,
  ReportListFilters,
  ReportSnapshotPayload,
  ReportSummary,
  ReportTemplatesResponse,
} from "./types";

/**
 * `/reports*` (customer-api, Reports v2). Everything goes through the generic `/api/backend` proxy
 * (tokens attached server-side) EXCEPT the PDF, which is binary: the proxy always `res.json()`s the backend
 * body, so the PDF goes through the bespoke same-origin route {@link reportDownloadPath} (the same pattern as the
 * billing receipt). The browser never holds a token and no token is ever placed in a URL.
 *
 * Every 4xx is rethrown as a `ReportApiError` (an `ApiError` subclass) carrying the typed `details.reason`.
 */

/** Same-origin route handler that streams the backend PDF with auth + one refresh retry. */
export const reportDownloadPath = (id: string) => `/api/reports/${encodeURIComponent(id)}/download`;

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toReportApiError(error);
  }
}

export const reportsApi = {
  /** `GET /reports/templates` (`reports.read`). Finance metrics are already filtered out server-side without `finance.read`. */
  templates(): Promise<ReportTemplatesResponse> {
    return guarded(() => apiFetch<ReportTemplatesResponse>("/reports/templates"));
  },

  /** `POST /reports/preview` (`reports.read` + plan feature `reports.generate`; throttled 3/min, one at a time per farm). */
  preview(request: PreviewReportRequest): Promise<ReportSnapshotPayload> {
    return guarded(() => apiFetch<ReportSnapshotPayload>("/reports/preview", { method: "POST", body: request }));
  },

  /**
   * `POST /reports` (`reports.create` + plan feature `reports.generate`). Returns the raw body: 201
   * `{duplicate:false, replayed, report}` or 200 `{duplicate:true, existing}` (use `toCreateResult`).
   * `idempotencyKey` is sent as the `Idempotency-Key` header.
   */
  create(request: CreateReportRequest, idempotencyKey: string): Promise<CreateReportResponse> {
    return guarded(() =>
      apiFetch<CreateReportResponse>("/reports", {
        method: "POST",
        body: request,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    );
  },

  /** `GET /reports` (cursor, newest first). */
  list(filters: ReportListFilters, cursor?: string, limit?: number): Promise<CursorPage<ReportSummary>> {
    return guarded(() =>
      apiFetchPage<ReportSummary>("/reports", {
        searchParams: { type: filters.type, origin: filters.origin, status: filters.status, cursor, limit },
      }),
    );
  },

  /** `GET /reports/:id` — `payload` is present only when COMPLETED. Unknown / other-farm / finance-hidden = 404. */
  get(id: string): Promise<ReportDetail> {
    return guarded(() => apiFetch<ReportDetail>(`/reports/${encodeURIComponent(id)}`));
  },

  /** `POST /reports/:id/retry` (`reports.create`) — FAILED -> QUEUED, max 3 manual retries. Returns the fresh summary. */
  retry(id: string): Promise<ReportSummary> {
    return guarded(() => apiFetch<ReportSummary>(`/reports/${encodeURIComponent(id)}/retry`, { method: "POST", body: {} }));
  },

  /** `DELETE /reports/:id` (`reports.delete`, farm owner only). */
  remove(id: string): Promise<{ deleted: true }> {
    return guarded(() => apiFetch<{ deleted: true }>(`/reports/${encodeURIComponent(id)}`, { method: "DELETE" }));
  },

  /** `GET /reports/:id/download` as a Blob + filename (from Content-Disposition). Non-2xx responses carry the JSON error envelope. */
  download(id: string): Promise<ReportDownload> {
    return guarded(async () => {
      let res: Response;
      try {
        res = await fetch(reportDownloadPath(id), { method: "GET", credentials: "same-origin" });
      } catch (cause) {
        throw new NetworkError(cause);
      }
      if (!res.ok) {
        let envelope: ApiEnvelope<unknown>;
        try {
          envelope = (await res.json()) as ApiEnvelope<unknown>;
        } catch (cause) {
          throw new NetworkError(cause);
        }
        // `unwrapEnvelope` throws the ApiError for a `success:false` body; a 2xx-shaped body on a non-ok status is still a failure.
        unwrapEnvelope(envelope, res.status);
        throw new NetworkError(new Error(`Unexpected ${res.status} on report download`));
      }
      const blob = await res.blob();
      const filename = parseContentDispositionFilename(res.headers.get("content-disposition"), fallbackReportFilename(id));
      return { blob, filename };
    });
  },
};
