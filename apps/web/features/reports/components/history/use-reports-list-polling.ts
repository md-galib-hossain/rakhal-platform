"use client"; // timers + visibility listener

import { useEffect, useRef } from "react";
import { REPORT_POLL_MAX_MS, isPendingStatus, type ReportSummary } from "@/features/reports";

/** History refresh cadence while something is generating. Slower than the detail page's 2 s: a list refetches every loaded page. */
export const REPORTS_LIST_POLL_MS = 4_000;

export const hasPendingReports = (rows: ReadonlyArray<Pick<ReportSummary, "status">>): boolean =>
  rows.some((row) => isPendingStatus(row.status));

/**
 * Keeps the history live: while any listed report is QUEUED/PROCESSING, calls `refetch` every few seconds; the
 * interval is torn down the moment nothing is pending (or after the shared 10 min safety stop, or while the tab is
 * hidden). It only calls the query's own `refetch`, so loaded rows stay on screen and the scroll position never moves.
 */
export function useReportsListPolling(
  rows: ReadonlyArray<Pick<ReportSummary, "status">>,
  refetch: () => unknown,
  intervalMs: number = REPORTS_LIST_POLL_MS,
): void {
  const pending = hasPendingReports(rows);
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    if (!pending) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - startedAt >= REPORT_POLL_MAX_MS) {
        window.clearInterval(id);
        return;
      }
      void refetchRef.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [pending, intervalMs]);
}
