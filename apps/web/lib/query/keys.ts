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
    sheds: () => ["settings", "sheds"] as const,
    feedGroups: () => ["settings", "feed-groups"] as const,
    suppliers: () => ["settings", "suppliers"] as const,
    serviceProviders: () => ["settings", "service-providers"] as const,
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
    weightHistory: (id: string, period: string) => ["cattle", "weight-history", id, period] as const,
    reproductionSummary: (id: string) => ["cattle", "reproduction-summary", id] as const,
    healthSummary: (id: string) => ["cattle", "health-summary", id] as const,
    calvingEvents: (id: string) => ["cattle", "calving-events", id] as const,
    holds: (id: string) => ["cattle", "holds", id] as const,
  },
  milk: {
    overview: (date: string | undefined, range?: string) => ["milk", "overview", date, range] as const,
    log: (date: string | undefined, shedId: string | undefined) => ["milk", "log", date, shedId] as const,
    anomalies: (date: string | undefined) => ["milk", "anomalies", date] as const,
    eligibility: (cattleId: string) => ["milk", "eligibility", cattleId] as const,
    qualityTests: (cattleId: string) => ["milk", "quality-tests", cattleId] as const,
  },
  inventory: {
    medicineDetail: (id: string) => ["inventory", "medicine", "detail", id] as const,
    feedItemDetail: (id: string) => ["inventory", "feed-item", "detail", id] as const,
    milkTanks: (filters: Record<string, string | undefined>) => ["inventory", "milk-tank", "list", filters] as const,
    milkTankAuditLog: (tankId: string | undefined) => ["inventory", "milk-tank", "audit-log", tankId] as const,
    teamMembers: () => ["inventory", "milk-tank", "team-members"] as const,
    semenTanks: () => ["inventory", "semen-tank", "list"] as const,
    equipmentDetail: (id: string) => ["inventory", "equipment", "detail", id] as const,
    /** RAKHAL-326 unit catalog. */
    units: (dimension?: string) => ["inventory", "units", "list", dimension] as const,
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
    /** RAKHAL-355, Finance V2 — `FinancialAccount` list (`AccountPicker`). Namespaced "v2" so a
     * broad `queryKey[0] === "finance"` invalidate predicate (none exists today, but V1's finance
     * hooks are the kind of file that could grow one) can't accidentally sweep this in or vice versa. */
    accountsV2: () => ["finance", "v2", "accounts"] as const,
    /** RAKHAL-356 — Rakhal Balance projection (`GET /finance/balance`). */
    balanceV2: () => ["finance", "v2", "balance"] as const,
    /** RAKHAL-356 — Transfer history (`GET /finance/transfers`). */
    transfersV2: () => ["finance", "v2", "transfers"] as const,
    /** RAKHAL-358 — Receivables/Payables cursor lists (`GET /finance/receivables`,
     * `GET /purchasing/payables`). */
    receivablesV2: (filters: Record<string, string | undefined>) => ["finance", "v2", "receivables", "list", filters] as const,
    payablesV2: (filters: Record<string, string | undefined>) => ["finance", "v2", "payables", "list", filters] as const,
    /** RAKHAL-358 — un-paginated Payments list + one payment's own detail (with allocations). */
    paymentsV2: () => ["finance", "v2", "payments", "list"] as const,
    paymentDetailV2: (id: string) => ["finance", "v2", "payments", "detail", id] as const,
    /** RAKHAL-358 — read-only reference lookups (`GET /sales`, `GET /purchasing/purchases`,
     * `GET /purchasing/expenses`), used only to decorate a Receivable/Payable row with a human
     * sale/purchase/expense reference — see `types-v2.ts#SaleSummary`'s doc comment. */
    salesLookupV2: () => ["finance", "v2", "sales-lookup"] as const,
    purchasesLookupV2: () => ["finance", "v2", "purchases-lookup"] as const,
    expensesLookupV2: () => ["finance", "v2", "expenses-lookup"] as const,
    /** RAKHAL-357 — Record Sale wizard: milk tank availability + Other Income categories. */
    milkAvailabilityV2: (tankId: string | undefined) => ["finance", "v2", "milk-availability", tankId] as const,
    incomeCategoriesV2: () => ["finance", "v2", "income-categories"] as const,
    /** RAKHAL-360 — redesigned Ledger view's "business document list" segments. `salesV2`/
     * `purchasesV2` are deliberately separate keys from RAKHAL-358's `salesLookupV2`/
     * `purchasesLookupV2` above even though both hit the same `GET /sales`/`GET /purchasing/
     * purchases` endpoints — this ticket's queryFn types the response as the full `Sale`/`Purchase`
     * shape (incl. `lines[]`) the Ledger's Sales/Purchases segments need to build a "what was
     * sold/bought" description, not the narrower `SaleSummary`/`PurchaseSummary` those two keys
     * cache; sharing one key across two differently-typed queryFns would be unsound. `paymentsV2`
     * is reused as-is (`FinancePayment[]`, identical shape both tickets need). */
    salesV2: () => ["finance", "v2", "sales", "list"] as const,
    purchasesV2: () => ["finance", "v2", "purchases", "list"] as const,
  },
  buyers: {
    statement: (id: string, month: string) => ["buyers", "statement", id, month] as const,
  },
  reproduction: {
    dashboard: () => ["reproduction", "dashboard"] as const,
    /** RAKHAL-363: OPEN/BRED_AWAITING_CONFIRMATION/PREGNANT cow list, `GET /reproduction/cows`. */
    cows: (status: string | undefined) => ["reproduction", "cows", status] as const,
    events: (filters: Record<string, string | number | undefined>) =>
      ["reproduction", "events", filters] as const,
    heatEvents: (cattleId: string | undefined) => ["reproduction", "heat-events", cattleId] as const,
    breedingEvents: (cattleId: string | undefined) => ["reproduction", "breeding-events", cattleId] as const,
    breedingEventDetail: (id: string | undefined) => ["reproduction", "breeding-events", "detail", id] as const,
    pregnancies: (cattleId: string | undefined) => ["reproduction", "pregnancies", cattleId] as const,
    calvingEvents: (cattleId: string | undefined) => ["reproduction", "calving-events", cattleId] as const,
    abortionEvents: (cattleId: string | undefined) => ["reproduction", "abortion-events", cattleId] as const,
    lactations: (cattleId: string | undefined) => ["reproduction", "lactations", cattleId] as const,
    lactationCurve: (lactationId: string | undefined, compareLactationId: string | undefined) =>
      ["reproduction", "lactations", "curve", lactationId, compareLactationId] as const,
    /** RAKHAL-291-F. */
    lactationStats: (lactationId: string | undefined) => ["reproduction", "lactations", "stats", lactationId] as const,
    lactationCompare: (cattleId: string | undefined, byLactationNumber: boolean) =>
      ["reproduction", "lactations", "compare", cattleId, byLactationNumber] as const,
    lactationCompareGroups: (groupBy: string) =>
      ["reproduction", "lactations", "compare-groups", groupBy] as const,
    protocols: () => ["reproduction", "protocols", "list"] as const,
    protocolKpis: () => ["reproduction", "protocols", "kpis"] as const,
    protocol: (id: string) => ["reproduction", "protocols", "detail", id] as const,
    protocolInstances: (filters: Record<string, string | undefined>) =>
      ["reproduction", "protocols", "instances", filters] as const,
  },
  feed: {
    ingredients: () => ["feed", "ingredients"] as const,
    ingredientsPaged: (filters: Record<string, string | number | undefined>) =>
      ["feed", "ingredients", "paged", filters] as const,
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
    resolvedRation: (cattleId: string) => ["feed", "resolved-ration", cattleId] as const,
    dmi: (cattleId: string, date?: string) => ["feed", "dmi", cattleId, date] as const,
    todaysRequirement: () => ["feed", "today-requirement"] as const,
    grid: (date: string, feedGroupId: string | undefined) => ["feed", "grid", date, feedGroupId] as const,
    refusalTrend: (feedGroupId: string) => ["feed", "refusal-trend", feedGroupId] as const,
    versions: (concentrationId: string) => ["feed", "versions", concentrationId] as const,
    costSummary: () => ["feed", "cost-summary"] as const,
  },
  calves: {
    list: (filters: Record<string, string | undefined>) => ["calves", "list", filters] as const,
    detail: (id: string) => ["calves", "detail", id] as const,
  },
  onboarding: {
    status: () => ["onboarding", "status"] as const,
  },
  reports: {
    catalogue: () => ["reports", "catalogue"] as const,
    job: (id: string) => ["reports", "job", id] as const,
    schedules: () => ["reports", "schedules"] as const,
  },
  /** RAKHAL-359, Finance V2 Purchasing — Expenses/Purchases/Payables (`purchasing/purchases`,
   * `purchasing/expenses`, `purchasing/payables`, RAKHAL-348/349). Own top-level namespace (not
   * nested under `finance`) since Purchasing is its own backend module, mirroring `sales`'s own
   * planned namespace. */
  purchasing: {
    expenses: () => ["purchasing", "expenses", "list"] as const,
    purchases: () => ["purchasing", "purchases", "list"] as const,
    payables: () => ["purchasing", "payables", "list"] as const,
  },
};
