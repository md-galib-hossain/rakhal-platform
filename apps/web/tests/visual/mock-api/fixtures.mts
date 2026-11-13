// Static fixtures for the visual-regression mock API. Each value is `{ data, meta? }`, the body of the success
// envelope (the server adds `success: true`), or a function of the request URL returning that.
// Every payload is checked against the app's own response types (`import type`, erased at runtime by Node), so a
// type change breaks `pnpm typecheck` instead of leaving a stale fixture. Nothing here may depend on the current
// date or on randomness: base and head runs must see byte-identical data.
import type { ActivityLogEntry } from "../../../features/activity/types";
import type {
  Breed,
  CattleHighlights,
  CattleListItem,
  Shed,
  AnimalGroup,
} from "../../../features/cattle/types";
import type {
  CalvingForecastResponse,
  ConceptionRateResponse,
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
} from "../../../features/dashboard/types";
import type { FarmSummary } from "../../../features/farm/types";
import type { FeedCostSummary } from "../../../features/feed/types";
import type { MilkOverviewResponse } from "../../../features/milk/types";
import type { NotificationListResult } from "../../../features/notifications/types";
import type { ProfileUser } from "../../../features/profile/types";
import type { ReportTemplatesResponse } from "../../../features/reports/types";
import type { SubscriptionSummary } from "../../../features/subscription/types";
import type { CursorMeta } from "../../../types/api";

export type Fixture = { data: unknown; meta?: unknown };
export type Handler = Fixture | ((url: URL) => Fixture);

const FARM_ID = "00000000-0000-4000-8000-0000000000f1";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function page<T>(items: T[], limit = 20): Fixture {
  const meta: CursorMeta = {
    count: items.length,
    limit,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: null,
  };
  return { data: items, meta };
}

// --- session and shell ------------------------------------------------------------------------------------

const profile: ProfileUser = {
  id: USER_ID,
  email: "owner@demo.rakhal.test",
  name: "Demo Owner",
  isEmailVerified: true,
  isBlocked: false,
  permissionsVersion: 1,
  preferredLanguage: "EN",
  lastLoginAt: "2026-01-14T06:00:00.000Z",
  lastPasswordChangedAt: null,
  createdAt: "2025-06-01T06:00:00.000Z",
  updatedAt: "2026-01-14T06:00:00.000Z",
  permissions: ["*"], // an Owner: the backend returns the wildcard, see lib/auth/permissions.tsx
};

const farms: FarmSummary[] = [
  { id: FARM_ID, name: "Demo Dairy Farm", slug: "demo-dairy", status: "ACTIVE", role: "OWNER" },
];

const subscription: SubscriptionSummary = {
  status: "ACTIVE",
  plan_id: id(900),
  plan_name: "Pro",
  expires_at: "2027-01-01T00:00:00.000Z",
  features: ["reports.generate"], // the report wizard is plan-gated on it
  limits: { max_cattle: null, max_farm_members: null },
  usage: { cattle: 8, farm_members: 3 },
  pending_plan_id: null,
  pending_plan_name: null,
  pending_effective_at: null,
};

const notifications: NotificationListResult = {
  unread_count: 0,
  notifications: [],
  meta: { page: 1, per_page: 20, total: 0 },
};

// --- animals ----------------------------------------------------------------------------------------------

const breeds: Breed[] = [
  { id: id(11), name: "Holstein Friesian" },
  { id: id(12), name: "Sahiwal" },
  { id: id(13), name: "Local" },
];
const sheds: Shed[] = [
  { id: id(21), name: "Shed A", code: "A" },
  { id: id(22), name: "Shed B", code: "B" },
];
const animalGroups: AnimalGroup[] = [
  { id: id(31), name: "High yielders", description: null, memberCount: 3 },
  { id: id(32), name: "Close-up dry", description: null, memberCount: 2 },
];

type Seed = Pick<
  CattleListItem,
  "name" | "tagNumber" | "gender" | "dateOfBirth" | "animalCategory" | "productionStatus"
> &
  Partial<CattleListItem>;

function animal(n: number, seed: Seed): CattleListItem {
  return {
    id: id(100 + n),
    herdStatus: "ACTIVE",
    deletedAt: null,
    shedId: n % 2 ? sheds[0].id : sheds[1].id,
    lastBcs: 3.25,
    lastWeightKg: 420,
    aqrScore: 78,
    breed: breeds[n % 3],
    shed: n % 2 ? sheds[0] : sheds[1],
    mother: null,
    father: null,
    reproductiveStatus: null,
    healthStatus: "HEALTHY",
    dim: null,
    lifecycleSubStage: null,
    reproductionAlerts: [],
    lactationStage: null,
    pregnancyStage: null,
    profile_photo: null,
    next_event: null,
    upcoming_event_count: 0,
    ...seed,
  };
}

const cattle: CattleListItem[] = [
  animal(1, {
    name: "Lakshmi",
    tagNumber: "RK-0001",
    gender: "FEMALE",
    dateOfBirth: "2021-03-10",
    animalCategory: "COW",
    productionStatus: "MILKING",
    dim: 84,
    lactationStage: "EARLY",
    reproductiveStatus: "OPEN",
  }),
  animal(2, {
    name: "Moti",
    tagNumber: "RK-0002",
    gender: "FEMALE",
    dateOfBirth: "2020-07-22",
    animalCategory: "COW",
    productionStatus: "MILKING",
    dim: 160,
    lactationStage: "MID",
    reproductiveStatus: "PREGNANT",
    pregnancyStage: "EARLY",
  }),
  animal(3, {
    name: "Gouri",
    tagNumber: "RK-0003",
    gender: "FEMALE",
    dateOfBirth: "2019-11-02",
    animalCategory: "COW",
    productionStatus: "DRY",
    lactationStage: "DRY_PERIOD",
    reproductiveStatus: "PREGNANT",
    pregnancyStage: "CLOSE_UP",
  }),
  animal(4, {
    name: "Shyama",
    tagNumber: "RK-0004",
    gender: "FEMALE",
    dateOfBirth: "2022-01-15",
    animalCategory: "COW",
    productionStatus: "MILKING",
    dim: 12,
    lactationStage: "FRESH",
    healthStatus: "IN_TREATMENT",
  }),
  animal(5, {
    name: "Bina",
    tagNumber: "RK-0005",
    gender: "FEMALE",
    dateOfBirth: "2024-02-01",
    animalCategory: "HEIFER",
    productionStatus: null,
    lifecycleSubStage: "GROWING_HEIFER",
  }),
  animal(6, {
    name: "Kalu",
    tagNumber: "RK-0006",
    gender: "MALE",
    dateOfBirth: "2018-05-20",
    animalCategory: "BULL",
    productionStatus: null,
    lifecycleSubStage: "MATURE_BULL",
  }),
  animal(7, {
    name: null,
    tagNumber: "RK-0007",
    gender: "FEMALE",
    dateOfBirth: "2025-11-20",
    animalCategory: "CALF",
    productionStatus: null,
  }),
  animal(8, {
    name: "Nandini",
    tagNumber: "RK-0008",
    gender: "FEMALE",
    dateOfBirth: "2021-09-09",
    animalCategory: "COW",
    productionStatus: "MILKING",
    dim: 210,
    lactationStage: "LATE",
    reproductiveStatus: "BRED_AWAITING_CONFIRMATION",
  }),
];

const byCategory: Record<string, (c: CattleListItem) => boolean> = {
  COW: (c) => c.animalCategory === "COW",
  HEIFER: (c) => c.animalCategory === "HEIFER",
  CALF: (c) => c.animalCategory === "CALF",
  MILKING: (c) => c.productionStatus === "MILKING",
  DRY: (c) => c.productionStatus === "DRY",
  FRESH: (c) => c.lactationStage === "FRESH",
  PREGNANT: (c) => c.reproductiveStatus === "PREGNANT",
  OPEN: (c) => c.reproductiveStatus === "OPEN",
  FEMALE: (c) => c.gender === "FEMALE",
  MALE: (c) => c.gender === "MALE",
  FATTENING: () => false,
  WEANED: () => false,
};

const highlights: CattleHighlights = {
  total_active: cattle.length,
  total_change_pct: 3.2,
  avg_herd_aqr: 78,
  aqr_change_pct: -1.1,
  breeding_ready_count: 2,
  todays_yield_l: 96.5,
  yield_change_pct: 4.1,
};

// --- dashboard --------------------------------------------------------------------------------------------

const priorities: PrioritiesResponse = {
  priorities: [
    {
      priority: "critical",
      icon: "alert",
      message: "1 animal is overdue for a health step",
      actionLabel: "Review",
      link: "/healthcare",
      count: 1,
    },
    {
      priority: "important",
      icon: "baby",
      message: "2 cows are due to calve this week",
      actionLabel: "Open",
      link: "/reproduction",
      count: 2,
    },
    {
      priority: "routine",
      icon: "milk",
      message: "Evening milk log is pending",
      actionLabel: "Log milk",
      link: "/milk",
    },
  ],
};
const kpis: KpisResponse = {
  costPerLitre: { value: 41.5, currency: "BDT" },
  todaysYield: {
    value: 96.5,
    unit: "L",
    changePct: 4.1,
    changeDirection: "up",
    changePeriod: "vs yesterday",
  },
  herdHealth: { value: 88, unit: "%", sickCount: 1, threshold: 80 },
  cashRunway: { value: 64, unit: "days", status: "healthy" },
};
const productionSummary: ProductionSummaryResponse = {
  period: "today",
  totalYieldL: 96.5,
  sellableL: 90,
  withholdingL: 4.5,
  calfAllocationL: 2,
  comparison: { yesterday: 92.7, sameDayLastWeek: 94, sameDayLastYear: 88 },
  sessions: { morning: "submitted", evening: "pending" },
};
const calvingForecast: CalvingForecastResponse = {
  forecast: [
    {
      cattleId: cattle[2].id,
      name: "Gouri",
      tag: "RK-0003",
      shed: "Shed A",
      expectedCalvingDate: "2026-01-22",
      daysRemaining: 7,
      conceptionDate: "2025-04-17",
    },
    {
      cattleId: cattle[1].id,
      name: "Moti",
      tag: "RK-0002",
      shed: "Shed B",
      expectedCalvingDate: "2026-03-02",
      daysRemaining: 46,
      conceptionDate: "2025-05-26",
    },
  ],
};
const herdStatus: HerdStatusResponse = {
  totalActive: 8,
  productionBreakdown: { milking: 4, dry: 1, fresh: 1 },
  categoryBreakdown: { calf: 1, heifer: 1, cow: 5, bull: 1, steer: 0 },
  reproductiveBreakdown: { open: 1, inseminated: 1, pregnant: 2, dryPeriod: 1 },
  healthBreakdown: { healthy: 7, sick: 0, inTreatment: 1, withholding: 1 },
  calves: { total: 1, newborn_0_7: 0, young_7_60: 1, pre_weaning_60_90: 0, post_weaning_90plus: 0 },
};
const livestockState = (url: URL): Fixture => {
  const body: LivestockStateResponse = {
    period: (url.searchParams.get("period") as LivestockStateResponse["period"] | null) ?? "month",
    states: [
      { state: "Milking", count: 4, color: "#00a86b" },
      { state: "Dry", count: 1, color: "#f59e0b" },
      { state: "Heifer", count: 1, color: "#3b82f6" },
      { state: "Calf", count: 1, color: "#8b5cf6" },
      { state: "Bull", count: 1, color: "#64748b" },
    ],
  };
  return { data: body };
};
const financialSnapshot: FinancialSnapshotResponse = {
  period: "month",
  income: { current: 182000, previous: 171000, changePct: 6.4 },
  expenses: { current: 121000, previous: 118000, changePct: 2.5 },
  profit: { current: 61000, previous: 53000, changePct: 15.1 },
  survivalRunway: { days: 64, availableLiquidity: 245000, status: "healthy" },
};
const financialPerformance: FinancialPerformanceResponse = {
  months: ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"].map((month, i) => ({
    month,
    label: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"][i],
    income: 150000 + i * 6000,
    expense: 108000 + i * 2500,
    profit: 42000 + i * 3500,
  })),
};
const productionVsFeedcost: ProductionVsFeedcostResponse = {
  days: Array.from({ length: 14 }, (_, i) => ({
    day: i + 1,
    productionL: 88 + ((i * 7) % 11),
    feedcost: 3900 + ((i * 13) % 9) * 40,
  })),
};
const conceptionRate: ConceptionRateResponse = {
  months: ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"].map((month, i) => ({
    month,
    label: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"][i],
    inseminations: 6 + (i % 3),
    confirmedPregnancies: 3 + (i % 3),
    ratePct: 50 + i * 3,
  })),
};
const feedStockAlerts: FeedStockAlertsResponse = {
  alerts: [
    {
      itemId: id(401),
      itemType: "feed_item",
      name: "Wheat bran",
      currentStock: 120,
      unit: "kg",
      threshold: 200,
      daysRemainingEstimate: 3,
      status: "critical",
    },
    {
      itemId: id(402),
      itemType: "medicine",
      name: "Oxytetracycline",
      currentStock: 4,
      unit: "bottle",
      threshold: 5,
      daysRemainingEstimate: null,
      status: "low",
    },
  ],
};
const upcomingTasks: UpcomingTasksResponse = {
  totalToday: 5,
  completedToday: 2,
  overdue: 1,
  byCategory: { HEALTH: { count: 2, overdue: 1 }, FEEDING: { count: 3, overdue: 0 } },
  tasks: [
    {
      id: id(501),
      name: "Deworming round, Shed A",
      category: "HEALTH",
      priority: "high",
      dueAt: "2026-01-15T10:00:00.000Z",
      status: "PENDING",
      assignedTo: "Demo Worker",
    },
    {
      id: id(502),
      name: "Refill mineral lick",
      category: "FEEDING",
      priority: "medium",
      dueAt: "2026-01-15T12:00:00.000Z",
      status: "PENDING",
      assignedTo: null,
    },
  ],
};
const activityLog: ActivityLogEntry[] = [
  {
    id: id(601),
    timestamp: "2026-01-15T05:40:00.000Z",
    module: "MILK_PRODUCTION",
    moduleLabel: "Milk",
    eventTitle: "Morning milk submitted",
    actionDetails: "48.5 L recorded for 4 cows",
    aqrImpact: null,
    financialImpact: null,
    actor: { id: USER_ID, name: "Demo Owner" },
    actorType: "user",
    dateGroup: "2026-01-15",
    hash: "0".repeat(64),
    relatedCattleId: null,
  },
  {
    id: id(602),
    timestamp: "2026-01-14T09:10:00.000Z",
    module: "HEALTH_SAFETY",
    moduleLabel: "Health",
    eventTitle: "Treatment logged",
    actionDetails: "Shyama: oxytetracycline 10 ml",
    aqrImpact: -2,
    financialImpact: null,
    actor: { id: USER_ID, name: "Demo Owner" },
    actorType: "user",
    dateGroup: "2026-01-14",
    hash: "1".repeat(64),
    relatedCattleId: cattle[3].id,
  },
];
const feedCostSummary: FeedCostSummary = {
  days: 7,
  total_cost: 27300,
  cost_per_cow_per_day: 487.5,
  cost_per_litre: 40.2,
  headcount: 8,
  total_litres: 679,
  trend: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-01-${String(9 + i).padStart(2, "0")}`,
    total_cost: 3850 + i * 30,
  })),
};
const milkOverview = (url: URL): Fixture => {
  const range = (url.searchParams.get("range") ?? "30d") as MilkOverviewResponse["trendRange"];
  const body: MilkOverviewResponse = {
    date: url.searchParams.get("date") ?? "2026-01-15",
    today: { totalL: 96.5, sellableL: 90, withholdingL: 4.5, calfL: 2 },
    yesterday: { totalL: 92.7 },
    sameDayLastWeek: { totalL: 94 },
    sameDayLastYear: { totalL: 88 },
    costPerLitreToday: null,
    marketValueToday: null,
    sessionsStatus: { morning: "submitted", evening: "pending" },
    trendRange: range,
    trend: Array.from({ length: 30 }, (_, i) => ({
      date: `2025-12-${String(17 + i).padStart(2, "0")}`,
      totalL: 88 + ((i * 5) % 13),
    })),
  };
  return { data: body };
};

// --- reports (wizard) -------------------------------------------------------------------------------------

const reportTemplates: ReportTemplatesResponse = {
  onDemand: {
    id: id(950),
    alias: "on-demand",
    version: 1,
    domains: ["milk", "health"],
    sections: [
      {
        id: "milk",
        domain: "milk",
        titleKey: "reports.domain.milk",
        metrics: [
          { id: "milk.total_yield", unit: "L", labelKey: "reports.metrics.milk.total_yield.label", definitionKey: "reports.metrics.milk.total_yield.definition", requiresFinance: false },
          { id: "milk.avg_daily_yield", unit: "L", labelKey: "reports.metrics.milk.avg_daily_yield.label", definitionKey: "reports.metrics.milk.avg_daily_yield.definition", requiresFinance: false },
        ],
      },
      {
        id: "health",
        domain: "health",
        titleKey: "reports.domain.health",
        metrics: [
          { id: "health.cases_opened", unit: "count", labelKey: "reports.metrics.health.cases_opened.label", definitionKey: "reports.metrics.health.cases_opened.definition", requiresFinance: false },
        ],
      },
    ],
  },
  scheduled: { weekly: { version: 1 }, monthly: { version: 1 } },
  datePresets: ["today", "this_week", "this_month", "this_year", "custom"],
  scopeKinds: ["SINGLE_COW", "GROUP", "ALL_ELIGIBLE"],
  limits: { maxMetrics: 20, maxCustomRangeDays: 366 },
};

// --- route table ------------------------------------------------------------------------------------------

export const routes: Record<string, Handler> = {
  "GET /auth/me": { data: profile },
  "GET /farms": { data: farms },
  "GET /subscription": { data: subscription },
  "GET /notifications": { data: notifications },

  "GET /breeds": page(breeds, 100),
  "GET /sheds": page(sheds, 100),
  "GET /animal-groups": page(animalGroups, 100),
  "GET /cattle/highlights": { data: highlights },
  "GET /cattle": (url) => {
    const category = url.searchParams.get("category");
    const filter = category ? byCategory[category] : undefined;
    return page(
      filter ? cattle.filter(filter) : cattle,
      Number(url.searchParams.get("limit") ?? 20),
    );
  },

  "GET /dashboard/priorities": { data: priorities },
  "GET /dashboard/kpis": { data: kpis },
  "GET /dashboard/production-summary": { data: productionSummary },
  "GET /dashboard/calving-forecast": { data: calvingForecast },
  "GET /dashboard/herd-status": { data: herdStatus },
  "GET /dashboard/livestock-state": livestockState,
  "GET /dashboard/financial-snapshot": { data: financialSnapshot },
  "GET /dashboard/financial-performance": { data: financialPerformance },
  "GET /dashboard/production-vs-feedcost": { data: productionVsFeedcost },
  "GET /dashboard/conception-rate": { data: conceptionRate },
  "GET /dashboard/feed-stock-alerts": { data: feedStockAlerts },
  "GET /dashboard/upcoming-tasks": { data: upcomingTasks },
  "GET /activity-log": page(activityLog, 15),
  "GET /feed/cost-summary": { data: feedCostSummary },
  "GET /milk/overview": milkOverview,
  "GET /reports/templates": { data: reportTemplates },
};
