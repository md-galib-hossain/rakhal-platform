/** One registry, no string-typo cache bugs (framework doc 02 §7). Extend per-feature as built.
 *
 * **Period-keyed convention (RAKHAL-380, MILESTONE 22, `BUSINESS_IA_PRD.md` §4.4, §6.1)**: any
 * `qk` entry backing a period-scoped read (a `from`/`to` finance/sales/purchasing report or
 * summary) MUST take that period as an explicit key argument — build it with
 * `toPeriodKey(usePeriod())` (`@/lib/period/presets`) so two different ranges never collide in
 * the cache. A **point-in-time** read (a balance, an account list, a chart-of-accounts value —
 * "where things stand right now") must NEVER take a period argument — `qk.finance.balanceV2`/
 * `accountsV2` below are the existing examples. This is the Row A (point-in-time) vs Row B
 * (period) split the design doc's own §4.4 draws: the key SHAPE itself enforces it, so a later
 * agent adding a new period-scoped report can't accidentally reuse a period-free balance's cache
 * entry (or vice versa) just by getting the arguments wrong. */
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
    animalGroups: () => ["cattle", "animal-groups"] as const,
    detail: (id: string) => ["cattle", "detail", id] as const,
    overview: (id: string) => ["cattle", "overview", id] as const,
    pedigree: (id: string) => ["cattle", "pedigree", id] as const,
    finance: (id: string, period: string | undefined) => ["cattle", "finance", id, period] as const,
    weightHistory: (id: string, period: string) => ["cattle", "weight-history", id, period] as const,
    reproductionSummary: (id: string) => ["cattle", "reproduction-summary", id] as const,
    healthSummary: (id: string) => ["cattle", "health-summary", id] as const,
    calvingEvents: (id: string) => ["cattle", "calving-events", id] as const,
    holds: (id: string) => ["cattle", "holds", id] as const,
    upcomingEvents: (id: string) => ["cattle", "upcoming-events", id] as const,
  },
  milk: {
    overview: (date: string | undefined, range?: string) => ["milk", "overview", date, range] as const,
    log: (date: string | undefined, shedId: string | undefined) => ["milk", "log", date, shedId] as const,
    anomalies: (date: string | undefined) => ["milk", "anomalies", date] as const,
    eligibility: (cattleId: string) => ["milk", "eligibility", cattleId] as const,
    qualityTests: (cattleId: string) => ["milk", "quality-tests", cattleId] as const,
    calendar: (month: string) => ["milk", "log", "calendar", month] as const,
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
    plans: () => ["health", "plans", "list"] as const,
    /** RAKHAL-415 — `GET /health/cases/applied` was removed, not aliased; replaced by
     * `GET /health/plan-applications` (grouped rounds, not one row per cow). */
    planApplications: (filters: Record<string, string | undefined>) => ["health", "plan-applications", "list", filters] as const,
    safetyWithdrawals: () => ["health", "safety-withdrawals", "list"] as const,
  },
  activity: {
    list: (filters: Record<string, string | undefined>) => ["activity", "list", filters] as const,
    /** RFE-042 — `GET /activity-log/verify-chain` integrity check. */
    chainIntegrity: () => ["activity", "chain-integrity"] as const,
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
    /** RAKHAL-383 — Finance Overview, first real consumer of RAKHAL-380's period-scoped `qk`
     * convention. `summaryPositionV2` deliberately carries **no period argument** — Row A
     * (`position.*`) must never refetch when the `DateRangePicker` changes, so its query key stays
     * constant regardless of what period is selected (`GET /finance/summary`'s `position` block
     * ignores `from`/`to` server-side too, per `PeriodSummaryService`'s own doc comment — this key
     * split makes that contract observable in the query cache, not just true by coincidence).
     * `summaryPeriodV2` takes `toPeriodKey(range)` (`lib/period/presets.ts`) — the Row B slice of
     * the exact same endpoint, correctly refetching per period. */
    summaryPositionV2: () => ["finance", "v2", "summary", "position"] as const,
    summaryPeriodV2: (periodKey: string) => ["finance", "v2", "summary", "period", periodKey] as const,
    recentTransactionsV2: (limit: number) => ["finance", "v2", "transactions", "recent", limit] as const,
    /** RAKHAL-385 — full Transactions screen: filtered, cursor "load more" feed off the same `GET
     * /finance/transactions` (RAKHAL-370) `recentTransactionsV2` above hits with a fixed `limit:5`
     * and no filters. Deliberately a separate key (not reused) — different `queryFn` shape
     * (`useInfiniteQuery` pages vs a single flat array) and a distinct filter set. */
    transactionsListV2: (filters: Record<string, string | undefined>) => ["finance", "v2", "transactions", "list", filters] as const,
    /** RAKHAL-386 — aging summary strip on the Receivables/Payables screens (`GET /finance/
     * receivables/aging`, `GET /purchasing/payables/aging`, both RAKHAL-369). No `asOf` argument —
     * always "as of now", matching the backend's own default when the query param is omitted. */
    receivablesAgingV2: () => ["finance", "v2", "receivables", "aging"] as const,
    payablesAgingV2: () => ["finance", "v2", "payables", "aging"] as const,
    /** RAKHAL-387 — Finance Reports tab. `GET /finance/reports/{profit-loss,cash-flow}?from&to`
     * (RAKHAL-379), period-keyed like `summaryPeriodV2` (RAKHAL-383's Row B convention) since both
     * always take an explicit `from`/`to`. */
    profitLossReportV2: (periodKey: string) => ["finance", "v2", "reports", "profit-loss", periodKey] as const,
    cashFlowReportV2: (periodKey: string) => ["finance", "v2", "reports", "cash-flow", periodKey] as const,
  },
  buyers: {
    statement: (id: string, month: string) => ["buyers", "statement", id, month] as const,
    /** RAKHAL-389 — `GET /buyers/summary`/`:id/overview` (RAKHAL-372). */
    summaryV2: () => ["buyers", "v2", "summary"] as const,
    overviewV2: (id: string) => ["buyers", "v2", "overview", id] as const,
    detailV2: (id: string) => ["buyers", "v2", "detail", id] as const,
  },
  /** RAKHAL-390 — Suppliers module read model (`GET /purchasing/suppliers`, `.../summary`,
   * RAKHAL-373). Distinct from `settings.suppliers()` (`GET /settings/suppliers`, the CRUD list
   * this module's writes still invalidate) — two different endpoints, two different cache entries. */
  suppliers: {
    listV2: () => ["suppliers", "v2", "list"] as const,
    summaryV2: () => ["suppliers", "v2", "summary"] as const,
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
    protocolInstance: (id: string | undefined) => ["reproduction", "protocols", "instances", "detail", id] as const,
  },
  feed: {
    ingredients: () => ["feed", "ingredients"] as const,
    ingredientsPaged: (filters: Record<string, string | number | undefined>) =>
      ["feed", "ingredients", "paged", filters] as const,
    concentrations: () => ["feed", "concentrations", "list"] as const,
    requirementSettings: () => ["feed", "requirement-settings"] as const,
    concentrationDetail: (id: string) => ["feed", "concentrations", "detail", id] as const,
    concentrationInventoryCheck: (id: string) => ["feed", "concentrations", "inventory-check", id] as const,
    /** Every input the requirement engine accepts — all of them belong in the key, or two
     * different cows/settings would share a cached result (RFE-103). */
    requirementsFor: (params: {
      cattleId?: string;
      weightKg?: number;
      milkTargetL?: number;
      milkFatPct?: number;
      milkProteinPct?: number;
      gestationDays?: number;
      bcs?: number;
      dim?: number;
      animalType?: string;
    }) =>
      ["feed", "requirements", "for", params] as const,
    stock: () => ["feed", "stock", "list"] as const,
    stockDetail: (id: string) => ["feed", "stock", "detail", id] as const,
    distributions: (params: Record<string, string | number | undefined>) =>
      ["feed", "distributions", "list", params] as const,
    efficiency: (params: { cattleId?: string; month?: string }) =>
      ["feed", "efficiency", params] as const,
    resolvedRation: (cattleId: string) => ["feed", "resolved-ration", cattleId] as const,
    dmi: (cattleId: string, date?: string) => ["feed", "dmi", cattleId, date] as const,
    todaysRequirement: () => ["feed", "today-requirement"] as const,
    /** MILESTONE 28 (RFE-129) — one prefix, so a save clears the detail and the history together. */
    requirementOverride: (cattleId: string) => ["feed", "requirement-override", cattleId, "detail"] as const,
    requirementOverrideHistory: (cattleId: string) => ["feed", "requirement-override", cattleId, "history"] as const,
    grid: (date: string) => ["feed", "grid", date] as const,
    gridCalendar: (month: string) => ["feed", "grid", "calendar", month] as const,
    cattleHistory: (cattleId: string, date: string | undefined) =>
      ["feed", "grid", "cattle-history", cattleId, date] as const,
    versions: (concentrationId: string) => ["feed", "versions", concentrationId] as const,
    costSummary: () => ["feed", "cost-summary"] as const,
    /** MILESTONE 27 (RFE-126) — all under `["feed","plans"]` so one prefix invalidation clears them. */
    plans: (filters: Record<string, string | boolean | undefined>) => ["feed", "plans", "list", filters] as const,
    planDetail: (id: string) => ["feed", "plans", "detail", id] as const,
    planFit: (id: string, cattleIds: string[]) => ["feed", "plans", "fit", id, cattleIds] as const,
    /** The plan editor's requirement scratchpad — keyed by the whole (unsaved) payload. */
    planPreviewFit: (payload: unknown) => ["feed", "plans", "preview-fit", payload] as const,
    planAssignments: (planId: string) => ["feed", "plans", "assignments", planId] as const,
    cattleProgram: (cattleId: string) => ["feed", "program", cattleId] as const,
  },
  calves: {
    list: (filters: Record<string, string | undefined>) => ["calves", "list", filters] as const,
    detail: (id: string) => ["calves", "detail", id] as const,
  },
  onboarding: {
    status: () => ["onboarding", "status"] as const,
  },
  /** RAKHAL-359, Finance V2 Purchasing — Expenses/Purchases/Payables (`purchasing/purchases`,
   * `purchasing/expenses`, `purchasing/payables`, RAKHAL-348/349). Own top-level namespace (not
   * nested under `finance`) since Purchasing is its own backend module, mirroring `sales`'s own
   * planned namespace. */
  purchasing: {
    expenses: () => ["purchasing", "expenses", "list"] as const,
    purchases: () => ["purchasing", "purchases", "list"] as const,
    payables: () => ["purchasing", "payables", "list"] as const,
    /** RAKHAL-391 (MILESTONE 22) — cursor-paginated, filtered `GET /purchasing/purchases` and
     * `/purchasing/expenses` (RAKHAL-375). `filters` includes `from`/`to`/`supplierId`/`paymentStatus`
     * (+`category` for expenses) so switching any filter or the shared `DateRangePicker` correctly
     * refetches, same convention `finance.transactionsListV2` established. */
    purchasesListV2: (filters: Record<string, string | undefined>) => ["purchasing", "v2", "purchases", "list", filters] as const,
    expensesListV2: (filters: Record<string, string | undefined>) => ["purchasing", "v2", "expenses", "list", filters] as const,
    /** One purchase with its lines + embedded payable (`GET /purchasing/purchases/:id`) — backs the detail sheet and the row "Pay" action. */
    purchaseDetailV2: (id: string) => ["purchasing", "v2", "purchases", "detail", id] as const,
    /** A supplier's recent purchases (`GET /purchasing/purchases?supplierId=`) — backs the supplier sheet. */
    supplierPurchasesV2: (supplierId: string) => ["purchasing", "v2", "purchases", "supplier", supplierId] as const,
    /** `GET /purchasing/summary?from&to` (RAKHAL-375) — period-keyed like `finance.profitLossReportV2`. */
    summaryV2: (periodKey: string) => ["purchasing", "v2", "summary", periodKey] as const,
  },
  /** RAKHAL-388 (MILESTONE 22) — Sales module Overview/Invoices/Dispatches. Own top-level
   * namespace (not nested under `finance`), same reasoning `purchasing`'s own doc comment gives —
   * Sales is its own backend module. */
  sales: {
    summaryV2: (periodKey: string) => ["sales", "v2", "summary", periodKey] as const,
    invoicesListV2: (filters: Record<string, string | undefined>) => ["sales", "v2", "invoices", "list", filters] as const,
    dispatchesListV2: (filters: Record<string, string | undefined>) => ["sales", "v2", "dispatches", "list", filters] as const,
    dispatchesSummaryV2: () => ["sales", "v2", "dispatches", "summary"] as const,
  },
  /** RFE-044 — global ⌘K search (`GET /search?q=`, RAKHAL-257). */
  search: {
    query: (q: string) => ["search", "query", q] as const,
  },
  /** RFE-043 — bell feed + preferences (`GET /notifications`, RAKHAL-098/099). */
  notifications: {
    /** `locale` is in the key because the backend renders the copy per `Accept-Language`. */
    list: (status: string, page: number, locale: string) =>
      ["notifications", "list", status, page, locale] as const,
    preferences: () => ["notifications", "preferences"] as const,
  },
  /** RFE-153 — Reports v2 (`/reports*`). `all()` is the invalidation prefix for every reports read. */
  reports: {
    all: () => ["reports"] as const,
    templates: () => ["reports", "templates"] as const,
    /** Infinite list: filters are part of the key, so each filter combination has its own cache entry. */
    list: (filters: Record<string, string | undefined>) => ["reports", "list", filters] as const,
    listAll: () => ["reports", "list"] as const,
    detail: (id: string) => ["reports", "detail", id] as const,
    /** Preview is a mutation (never cached); this key exists only so a wizard can store/read the last result. */
    preview: () => ["reports", "preview"] as const,
  },
};
