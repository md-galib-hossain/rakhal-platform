"use client";

import { useQuery } from "@tanstack/react-query";
import { shouldRetryInfinite } from "@/lib/hooks/use-infinite-cursor-list";
import { qk } from "@/lib/query/keys";
import { reportsApi } from "../api";

const TEMPLATES_STALE_MS = 5 * 60_000;

/**
 * `GET /reports/templates` — the on-demand catalogue (sections -> metrics, already finance-filtered by the
 * server), scheduled-template versions, presets, scope kinds and limits. Rarely changes; cached 5 min.
 * Pass `enabled: false` for callers without `reports.read` / the plan feature.
 */
export function useReportTemplates(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.reports.templates(),
    queryFn: () => reportsApi.templates(),
    staleTime: TEMPLATES_STALE_MS,
    enabled: options.enabled,
    retry: shouldRetryInfinite,
  });
}
