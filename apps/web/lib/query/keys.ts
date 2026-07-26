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
  billing: {
    plans: () => ["billing", "plans"] as const,
    invoices: () => ["billing", "invoices"] as const,
  },
  settings: {
    farm: () => ["settings", "farm"] as const,
    team: () => ["settings", "team"] as const,
    roles: () => ["settings", "roles"] as const,
  },
  legal: {
    consent: () => ["legal", "consent"] as const,
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
  inventory: {
    medicineDetail: (id: string) => ["inventory", "medicine", "detail", id] as const,
    feedItemDetail: (id: string) => ["inventory", "feed-item", "detail", id] as const,
    milkTanks: (filters: Record<string, string | undefined>) => ["inventory", "milk-tank", "list", filters] as const,
    milkTankAuditLog: (tankId: string | undefined) => ["inventory", "milk-tank", "audit-log", tankId] as const,
    teamMembers: () => ["inventory", "milk-tank", "team-members"] as const,
    semenTanks: () => ["inventory", "semen-tank", "list"] as const,
    equipmentDetail: (id: string) => ["inventory", "equipment", "detail", id] as const,
  },
  health: {
    dashboard: () => ["health", "dashboard"] as const,
    sickBay: (filters: Record<string, string | undefined>) => ["health", "sick-bay", "list", filters] as const,
    caseDetail: (id: string) => ["health", "case", "detail", id] as const,
    tasks: () => ["health", "tasks", "list"] as const,
    taskCalendar: (year: number, month: number) => ["health", "tasks", "calendar", year, month] as const,
    plans: () => ["health", "plans", "list"] as const,
    safetyWithdrawals: () => ["health", "safety-withdrawals", "list"] as const,
  },
  activity: {
    list: (filters: Record<string, string | undefined>) => ["activity", "list", filters] as const,
  },
  tasks: {
    list: (filters: Record<string, string | undefined>) => ["tasks", "list", filters] as const,
    teamMembers: () => ["tasks", "team-members"] as const,
  },
  finance: {
    highlights: () => ["finance", "highlights"] as const,
    liabilities: () => ["finance", "liabilities"] as const,
    assets: () => ["finance", "assets"] as const,
    wallet: () => ["finance", "wallet"] as const,
  },
  buyers: {
    statement: (id: string, month: string) => ["buyers", "statement", id, month] as const,
  },
  reproduction: {
    dashboard: () => ["reproduction", "dashboard"] as const,
    events: (filters: Record<string, string | number | undefined>) =>
      ["reproduction", "events", filters] as const,
    heatEvents: (cattleId: string | undefined) => ["reproduction", "heat-events", cattleId] as const,
    breedingEvents: (cattleId: string | undefined) => ["reproduction", "breeding-events", cattleId] as const,
    pregnancies: (cattleId: string | undefined) => ["reproduction", "pregnancies", cattleId] as const,
    calvingEvents: (cattleId: string | undefined) => ["reproduction", "calving-events", cattleId] as const,
    abortionEvents: (cattleId: string | undefined) => ["reproduction", "abortion-events", cattleId] as const,
    lactations: (cattleId: string | undefined) => ["reproduction", "lactations", cattleId] as const,
    protocols: () => ["reproduction", "protocols", "list"] as const,
    protocolKpis: () => ["reproduction", "protocols", "kpis"] as const,
    protocol: (id: string) => ["reproduction", "protocols", "detail", id] as const,
    protocolInstances: (filters: Record<string, string | undefined>) =>
      ["reproduction", "protocols", "instances", filters] as const,
  },
  feed: {
    ingredients: () => ["feed", "ingredients"] as const,
    concentrations: () => ["feed", "concentrations", "list"] as const,
    concentrationDetail: (id: string) => ["feed", "concentrations", "detail", id] as const,
    requirementsFor: (params: { cattleId?: string; feedGroupId?: string; weightKg?: number; milkTargetL?: number }) =>
      ["feed", "requirements", "for", params] as const,
    feedGroups: () => ["feed", "feed-groups"] as const,
    stock: () => ["feed", "stock", "list"] as const,
    stockDetail: (id: string) => ["feed", "stock", "detail", id] as const,
    distributions: (params: Record<string, string | number | undefined>) =>
      ["feed", "distributions", "list", params] as const,
    efficiency: (params: { feedGroupId?: string; cattleId?: string; month?: string }) =>
      ["feed", "efficiency", params] as const,
  },
  calves: {
    list: (filters: Record<string, string | undefined>) => ["calves", "list", filters] as const,
    detail: (id: string) => ["calves", "detail", id] as const,
  },
  onboarding: {
    status: () => ["onboarding", "status"] as const,
  },
};
