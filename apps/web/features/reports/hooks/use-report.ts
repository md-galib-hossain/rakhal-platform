"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { shouldRetryInfinite } from "@/lib/hooks/use-infinite-cursor-list";
import { qk } from "@/lib/query/keys";
import { reportsApi } from "../api";
import { nextReportPollInterval, REPORT_POLL_MAX_MS } from "../lib/polling";
import { isPendingStatus } from "../types";

/**
 * `GET /reports/:id` that follows generation: re-fetches every 2 s while the status is QUEUED/PROCESSING and
 * stops on COMPLETED / FAILED, on a fetch error, or after a 10-minute safety stop (`pollTimedOut`: the UI shows
 * "taking longer than usual" with a manual refresh). Returns the normal react-query result plus `pollTimedOut`
 * and `isPolling`. A terminal row is cached for a minute and not polled again.
 */
export function useReport(id: string | undefined, options: { enabled?: boolean } = {}) {
  const startRef = useRef<{ id: string; at: number } | null>(null);
  const [timedOutId, setTimedOutId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: qk.reports.detail(id ?? ""),
    queryFn: () => reportsApi.get(id as string),
    enabled: !!id && options.enabled !== false,
    staleTime: 15_000,
    retry: shouldRetryInfinite,
    refetchInterval: (q) => {
      const start = startRef.current;
      return nextReportPollInterval({
        status: q.state.data?.status,
        isError: q.state.status === "error",
        elapsedMs: start && start.id === id ? Date.now() - start.at : 0,
      });
    },
  });

  const status = query.data?.status;
  const pending = !!status && isPendingStatus(status);

  // Start the safety clock when this report is first seen pending; arm one timer to flip `pollTimedOut`.
  useEffect(() => {
    if (!id || !pending) return;
    if (!startRef.current || startRef.current.id !== id) startRef.current = { id, at: Date.now() };
    const remaining = Math.max(0, REPORT_POLL_MAX_MS - (Date.now() - startRef.current.at));
    const timer = setTimeout(() => setTimedOutId(id), remaining);
    return () => clearTimeout(timer);
  }, [id, pending]);

  const pollTimedOut = pending && !!id && timedOutId === id;

  return {
    ...query,
    pollTimedOut,
    /** True while the 2 s loop is running. */
    isPolling: pending && !pollTimedOut && !query.isError,
  };
}
