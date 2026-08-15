/**
 * Mirrors `rakhal-backend/src/modules/dashboard/application/services/dashboard.service.ts` response
 * shapes exactly (camelCase, read directly from the service — not the aspirational `Rakhal_API.md`,
 * which lists a 10th "activity-feed" widget the real backend doesn't implement; this module only has
 * the 9 real `GET /dashboard/*` routes, see `dashboard.controller.ts`).
 */

export type DashboardPeriod = "today" | "week" | "month";

export interface PriorityItem {
  priority: "critical" | "urgent" | "important" | "operational" | "routine";
  icon: string;
  message: string;
  actionLabel: string;
  link: string;
  count?: number;
  cattleId?: string;
  expectedDate?: string;
  /** Per-cow detail for a grouped row (e.g. "5 cow(s) overdue") — expandable in the UI when >1. */
  cattle?: Array<{ id: string; name: string | null; tag: string }>;
  /** True when `cattle` was capped server-side (more rows exist than are listed). */
  truncated?: boolean;
}

export interface PrioritiesResponse {
  priorities: PriorityItem[];
}

export interface KpisResponse {
  costPerLitre: { value: number; currency: string };
  todaysYield: {
    value: number;
    unit: string;
    changePct: number | null;
    changeDirection: "up" | "down" | null;
    changePeriod: string;
  };
  herdHealth: { value: number; unit: string; sickCount: number; threshold: number };
  cashRunway: { value: number; unit: string; status: string };
}

export interface ProductionSummaryResponse {
  period: DashboardPeriod;
  totalYieldL: number;
  sellableL: number;
  withholdingL: number;
  calfAllocationL: number;
  comparison: { yesterday: number; sameDayLastWeek: number; sameDayLastYear: number } | null;
  /** Flat `session -> "submitted"|"pending"|"not_configured"` map — `MilkService#sessionStatuses`'s
   * real return shape, not the richer per-session object the aspirational `Rakhal_API.md` shows. */
  sessions: Record<string, "submitted" | "pending" | "not_configured"> | null;
}

export interface CalvingForecastItem {
  cattleId: string;
  name: string;
  tag: string;
  shed: string | null;
  expectedCalvingDate: string;
  daysRemaining: number | null;
  conceptionDate: string | null;
}

export interface CalvingForecastResponse {
  forecast: CalvingForecastItem[];
}

export interface HerdStatusResponse {
  totalActive: number;
  /** `growing` (an `AnimalCategory.HEIFER` proxy) was dropped — see `categoryBreakdown` below for
   * the real, mutually-exclusive partition. `milking`/`dry`/`fresh` stay (independent, overlapping
   * production-state dimensions, not a partition — still the real shape `LivestockStateChart`'s
   * backing data conceptually mirrors, even though that widget reads its own separate
   * `LivestockStateResponse` endpoint, not this field, directly). */
  productionBreakdown: { milking: number; dry: number; fresh: number };
  /** Real partition by construction: every active cow has exactly one `AnimalCategory`, so these 5
   * values always sum to `totalActive` (fixes the old `productionBreakdown` donut, which mixed 4
   * independent overlapping dimensions as if they were pie slices). */
  categoryBreakdown: { calf: number; heifer: number; cow: number; bull: number; steer: number };
  reproductiveBreakdown: { open: number; inseminated: number; pregnant: number; dryPeriod: number };
  healthBreakdown: { healthy: number; sick: number; inTreatment: number; withholding: number };
  calves: {
    total: number;
    newborn_0_7: number;
    young_7_60: number;
    pre_weaning_60_90: number;
    post_weaning_90plus: number;
  };
}

export interface LivestockStateResponse {
  period: DashboardPeriod;
  states: Array<{ state: string; count: number; color: string }>;
}

export interface FinancialSnapshotResponse {
  period: string;
  income: { current: number; previous: number; changePct: number | null };
  expenses: { current: number; previous: number; changePct: number | null };
  profit: { current: number; previous: number; changePct: number | null };
  survivalRunway: { days: number; availableLiquidity: number; status: string };
}

export interface FinancialPerformanceResponse {
  months: Array<{ month: string; label: string; income: number; expense: number; profit: number }>;
}

export interface ProductionVsFeedcostResponse {
  days: Array<{ day: number; productionL: number; feedcost: number }>;
}

export interface ConceptionRateResponse {
  months: Array<{
    month: string;
    label: string;
    inseminations: number;
    confirmedPregnancies: number;
    ratePct: number;
  }>;
}

export interface FeedStockAlertItem {
  itemId: string;
  itemType: "medicine" | "feed_item";
  name: string;
  currentStock: number;
  unit: string;
  threshold: number;
  daysRemainingEstimate: number | null;
  status: "critical" | "low";
}

export interface FeedStockAlertsResponse {
  alerts: FeedStockAlertItem[];
}

export interface UpcomingTaskItem {
  id: string;
  name: string;
  category: string;
  priority: string;
  dueAt: string;
  status: string;
  assignedTo: string | null;
}

export interface UpcomingTasksResponse {
  totalToday: number;
  completedToday: number;
  overdue: number;
  byCategory: Record<string, { count: number; overdue: number }>;
  tasks: UpcomingTaskItem[];
}
