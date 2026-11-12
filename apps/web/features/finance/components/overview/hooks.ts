"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { toPeriodKey, type PeriodRange } from "@/lib/period/presets";
import { overviewApi } from "./api";

const STALE_TIME = 30_000;
/** Any fixed instant works — `PeriodSummaryService`'s `position` block ignores `from`/`to`
 * entirely, so this only exists to satisfy the (required) query params. */
const POSITION_QUERY_FROM = new Date(0).toISOString();

/** Row A — position, period-independent. `qk.finance.summaryPositionV2()` never changes, so this
 * never refetches when the Overview's `DateRangePicker` changes period — RAKHAL-383's own AC. */
export function usePositionSummary() {
  return useQuery({
    queryKey: qk.finance.summaryPositionV2(),
    queryFn: () => overviewApi.getSummary(POSITION_QUERY_FROM, new Date().toISOString()),
    staleTime: STALE_TIME,
    select: (data) => data.position,
  });
}

/** Row B — period-scoped metrics, refetches on period change via `toPeriodKey`. */
export function usePeriodSummary(range: PeriodRange) {
  const periodKey = toPeriodKey(range);
  return useQuery({
    queryKey: qk.finance.summaryPeriodV2(periodKey),
    queryFn: () => overviewApi.getSummary(range.from.toISOString(), range.to.toISOString()),
    staleTime: STALE_TIME,
  });
}

export function useRecentTransactions(limit: number) {
  return useQuery({
    queryKey: qk.finance.recentTransactionsV2(limit),
    queryFn: () => overviewApi.listRecentTransactions(limit),
    staleTime: STALE_TIME,
    select: (page) => page.items,
  });
}
