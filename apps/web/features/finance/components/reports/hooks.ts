"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { toPeriodKey, type PeriodRange } from "@/lib/period/presets";
import { financeReportsApi } from "./api";

const STALE_TIME = 30_000;

/** RAKHAL-387 — period-scoped like `usePeriodSummary` (RAKHAL-383's Row B convention): the query
 * key carries `toPeriodKey(range)`, so switching the shared `DateRangePicker` correctly refetches
 * both reports. */
export function useProfitLossReport(range: PeriodRange) {
  const periodKey = toPeriodKey(range);
  return useQuery({
    queryKey: qk.finance.profitLossReportV2(periodKey),
    queryFn: () => financeReportsApi.profitLoss(range.from.toISOString(), range.to.toISOString()),
    staleTime: STALE_TIME,
  });
}

export function useCashFlowReport(range: PeriodRange) {
  const periodKey = toPeriodKey(range);
  return useQuery({
    queryKey: qk.finance.cashFlowReportV2(periodKey),
    queryFn: () => financeReportsApi.cashFlow(range.from.toISOString(), range.to.toISOString()),
    staleTime: STALE_TIME,
  });
}
