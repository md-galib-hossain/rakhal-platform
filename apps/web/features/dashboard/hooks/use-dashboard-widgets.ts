"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { dashboardApi } from "../api";
import type { DashboardPeriod } from "../types";

/** Every widget gets its own query — a failed/slow widget never blocks its siblings, and each one's
 * `isLoading`/`isError`/`data` drives its own skeleton/error/empty/success state (ARCHITECTURE.md §8.3)
 * in place of a separate React ErrorBoundary-per-widget: a query failure here is already isolated to
 * just that widget's own component tree, same fault-isolation the ticket's "ErrorBoundary" phrasing
 * asks for, without introducing a second, unestablished error-handling pattern into the codebase. */
const STALE_TIME = 60_000;

export function usePriorities() {
  return useQuery({ queryKey: qk.dashboard.priorities(), queryFn: dashboardApi.priorities, staleTime: STALE_TIME });
}

export function useKpis() {
  return useQuery({ queryKey: qk.dashboard.kpis(), queryFn: dashboardApi.kpis, staleTime: STALE_TIME });
}

export function useProductionSummary(period: DashboardPeriod) {
  return useQuery({
    queryKey: qk.dashboard.productionSummary(period),
    queryFn: () => dashboardApi.productionSummary(period),
    staleTime: STALE_TIME,
  });
}

export function useCalvingForecast() {
  return useQuery({
    queryKey: qk.dashboard.calvingForecast(),
    queryFn: dashboardApi.calvingForecast,
    staleTime: STALE_TIME,
  });
}

export function useHerdStatus() {
  return useQuery({ queryKey: qk.dashboard.herdStatus(), queryFn: dashboardApi.herdStatus, staleTime: STALE_TIME });
}

export function useLivestockState(period: DashboardPeriod) {
  return useQuery({
    queryKey: qk.dashboard.livestockState(period),
    queryFn: () => dashboardApi.livestockState(period),
    staleTime: STALE_TIME,
  });
}

export function useFinancialSnapshot() {
  return useQuery({
    queryKey: qk.dashboard.financialSnapshot(),
    queryFn: dashboardApi.financialSnapshot,
    staleTime: STALE_TIME,
  });
}

export function useFinancialPerformance() {
  return useQuery({
    queryKey: qk.dashboard.financialPerformance(),
    queryFn: dashboardApi.financialPerformance,
    staleTime: STALE_TIME,
  });
}

export function useProductionVsFeedcost() {
  return useQuery({
    queryKey: qk.dashboard.productionVsFeedcost(),
    queryFn: dashboardApi.productionVsFeedcost,
    staleTime: STALE_TIME,
  });
}

export function useConceptionRate() {
  return useQuery({
    queryKey: qk.dashboard.conceptionRate(),
    queryFn: dashboardApi.conceptionRate,
    staleTime: STALE_TIME,
  });
}

export function useFeedStockAlerts() {
  return useQuery({
    queryKey: qk.dashboard.feedStockAlerts(),
    queryFn: dashboardApi.feedStockAlerts,
    staleTime: STALE_TIME,
  });
}

export function useUpcomingTasks() {
  return useQuery({
    queryKey: qk.dashboard.upcomingTasks(),
    queryFn: dashboardApi.upcomingTasks,
    staleTime: STALE_TIME,
  });
}
