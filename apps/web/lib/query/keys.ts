/** One registry, no string-typo cache bugs (framework doc 02 §7). Extend per-feature as built. */
export const qk = {
  auth: {
    session: () => ["auth", "session"] as const,
  },
  profile: {
    me: () => ["profile", "me"] as const,
    sessions: () => ["profile", "sessions"] as const,
  },
  farm: {
    list: () => ["farm", "list"] as const,
  },
  subscription: {
    current: () => ["subscription", "current"] as const,
  },
  dashboard: {
    priorities: () => ["dashboard", "priorities"] as const,
    kpis: () => ["dashboard", "kpis"] as const,
    productionSummary: (period: string) => ["dashboard", "production-summary", period] as const,
    calvingForecast: () => ["dashboard", "calving-forecast"] as const,
    herdStatus: () => ["dashboard", "herd-status"] as const,
    livestockState: (period: string) => ["dashboard", "livestock-state", period] as const,
    financialSnapshot: () => ["dashboard", "financial-snapshot"] as const,
    financialPerformance: () => ["dashboard", "financial-performance"] as const,
    productionVsFeedcost: () => ["dashboard", "production-vs-feedcost"] as const,
    conceptionRate: () => ["dashboard", "conception-rate"] as const,
    feedStockAlerts: () => ["dashboard", "feed-stock-alerts"] as const,
    upcomingTasks: () => ["dashboard", "upcoming-tasks"] as const,
  },
  cattle: {
    list: (filters: Record<string, string | undefined>) => ["cattle", "list", filters] as const,
    highlights: () => ["cattle", "highlights"] as const,
    breeds: () => ["cattle", "breeds"] as const,
    sheds: () => ["cattle", "sheds"] as const,
    feedGroups: () => ["cattle", "feed-groups"] as const,
    detail: (id: string) => ["cattle", "detail", id] as const,
    overview: (id: string) => ["cattle", "overview", id] as const,
    pedigree: (id: string) => ["cattle", "pedigree", id] as const,
    finance: (id: string, period: string | undefined) => ["cattle", "finance", id, period] as const,
    reproductionSummary: (id: string) => ["cattle", "reproduction-summary", id] as const,
    healthSummary: (id: string) => ["cattle", "health-summary", id] as const,
    calvingEvents: (id: string) => ["cattle", "calving-events", id] as const,
  },
  milk: {
    overview: (date: string | undefined) => ["milk", "overview", date] as const,
    log: (date: string | undefined, shedId: string | undefined) => ["milk", "log", date, shedId] as const,
    anomalies: (date: string | undefined) => ["milk", "anomalies", date] as const,
  },
};
