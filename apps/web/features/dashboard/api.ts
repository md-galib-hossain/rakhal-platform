"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  CalvingForecastResponse,
  DashboardPeriod,
  FeedStockAlertsResponse,
  FinancialSnapshotResponse,
  HerdStatusResponse,
  KpisResponse,
  LivestockStateResponse,
  PrioritiesResponse,
  ProductionSummaryResponse,
  UpcomingTasksResponse,
} from "./types";

/** `GET /dashboard/*` — real backend routes (`dashboard.controller.ts`), all `dashboard.read`-gated. */
export const dashboardApi = {
  priorities(): Promise<PrioritiesResponse> {
    return apiFetch<PrioritiesResponse>("/dashboard/priorities");
  },
  kpis(): Promise<KpisResponse> {
    return apiFetch<KpisResponse>("/dashboard/kpis");
  },
  productionSummary(period: DashboardPeriod): Promise<ProductionSummaryResponse> {
    return apiFetch<ProductionSummaryResponse>("/dashboard/production-summary", { searchParams: { period } });
  },
  calvingForecast(): Promise<CalvingForecastResponse> {
    return apiFetch<CalvingForecastResponse>("/dashboard/calving-forecast");
  },
  herdStatus(): Promise<HerdStatusResponse> {
    return apiFetch<HerdStatusResponse>("/dashboard/herd-status");
  },
  livestockState(period: DashboardPeriod): Promise<LivestockStateResponse> {
    return apiFetch<LivestockStateResponse>("/dashboard/livestock-state", { searchParams: { period } });
  },
  financialSnapshot(): Promise<FinancialSnapshotResponse> {
    return apiFetch<FinancialSnapshotResponse>("/dashboard/financial-snapshot");
  },
  feedStockAlerts(): Promise<FeedStockAlertsResponse> {
    return apiFetch<FeedStockAlertsResponse>("/dashboard/feed-stock-alerts");
  },
  upcomingTasks(): Promise<UpcomingTasksResponse> {
    return apiFetch<UpcomingTasksResponse>("/dashboard/upcoming-tasks");
  },
};
