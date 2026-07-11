"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  CalvingForecastResponse,
  ConceptionRateResponse,
  DashboardPeriod,
  FeedStockAlertsResponse,
  FinancialPerformanceResponse,
  FinancialSnapshotResponse,
  HerdStatusResponse,
  KpisResponse,
  LivestockStateResponse,
  PrioritiesResponse,
  ProductionSummaryResponse,
  ProductionVsFeedcostResponse,
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
  financialPerformance(): Promise<FinancialPerformanceResponse> {
    return apiFetch<FinancialPerformanceResponse>("/dashboard/financial-performance");
  },
  productionVsFeedcost(): Promise<ProductionVsFeedcostResponse> {
    return apiFetch<ProductionVsFeedcostResponse>("/dashboard/production-vs-feedcost");
  },
  conceptionRate(): Promise<ConceptionRateResponse> {
    return apiFetch<ConceptionRateResponse>("/dashboard/conception-rate");
  },
  feedStockAlerts(): Promise<FeedStockAlertsResponse> {
    return apiFetch<FeedStockAlertsResponse>("/dashboard/feed-stock-alerts");
  },
  upcomingTasks(): Promise<UpcomingTasksResponse> {
    return apiFetch<UpcomingTasksResponse>("/dashboard/upcoming-tasks");
  },
};
