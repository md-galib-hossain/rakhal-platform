/**
 * Every metric id the backend can emit today, from `application/metrics/** /*-definitions.ts` and
 * `infrastructure/renderer/report-labels.ts` (METRIC_LABELS). The backend registry is the source of
 * truth: a new id there still renders (`humanizeMetricId` fallback) but must be added here + in
 * `reports.metrics.*` of both locales (the i18n parity test fails otherwise).
 */
export const REPORT_METRIC_IDS = [
  "milk.total_yield",
  "milk.avg_daily_yield",
  "milk.cows_with_data",
  "milk.expected_cow_days",
  "milk.recorded_cow_days",
  "milk.daily_yield",
  "milk.cow_total_yield",
  "milk.cow_avg_daily_yield",
  "milk.cow_recorded_days",
  "milk.cow_expected_days",
  "milk.top_cow_avg_yield",
  "milk.bottom_cow_avg_yield",
  "milk.disposition_yield",
  "milk.sudden_drop_cows",
  "health.cases_opened",
  "health.cows_with_cases_opened",
  "health.treatments_given",
  "health.cows_treated",
  "health.cases_closed",
  "health.cases_recovered",
  "health.cases_mortality",
  "health.cases_open_at_period_end",
  "health.preventive_tasks_completed",
  "health.preventive_tasks_missed",
  "health.tasks_overdue",
  "health.cases_repeated",
  "health.withdrawals_active",
  "health.treatment_cost",
  "health.vet_fees",
  "reproduction.services_total",
  "reproduction.services_ai",
  "reproduction.services_natural",
  "reproduction.services_embryo_transfer",
  "reproduction.services_unique_cows",
  "reproduction.outcomes_confirmed",
  "reproduction.outcomes_pending",
  "reproduction.outcomes_failed",
  "reproduction.outcomes_other",
  "reproduction.services_decided",
  "reproduction.conception_rate",
  "reproduction.pregnancy_checks_overdue",
  "reproduction.calvings",
  "reproduction.calves_born",
  "reproduction.abortions",
  "reproduction.expected_calvings_30d",
  "reproduction.ai_cost_total",
  "feed.recorded_actual_kg",
  "feed.refusal_kg",
  "feed.offered_minus_refusal_kg",
  "feed.tmr_fed_kg",
  "feed.fit_off_target_share",
  "feed.fit_estimated_cow_days",
  "feed.low_stock_items",
  "feed.distribution_cost",
  "feed.distribution_cost_known_only",
  "feed.distribution_cost_coverage",
  "feed.cost_per_cow_day",
  "feed.cost_per_litre",
  "feed.ledger_feed_spend",
  "finance.cash_received",
  "finance.cash_paid",
  "finance.net_cash_flow",
  "finance.opening_cash_balance",
  "finance.closing_cash_balance",
  "finance.expenses_total",
] as const;
export type KnownMetricId = (typeof REPORT_METRIC_IDS)[number];

/** Backend `ExpenseCategory` (prisma purchase.enums). `finance.expenses_by_category.<CAT>` ids are generated per category. */
export const REPORT_EXPENSE_CATEGORIES = [
  "SALARY",
  "UTILITIES",
  "BREEDING",
  "TRANSFER_FEE",
  "DEPRECIATION",
  "OTHER",
  "HEALTH",
] as const;
export type ReportExpenseCategory = (typeof REPORT_EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_METRIC_PREFIX = "finance.expenses_by_category.";

const KNOWN = new Set<string>(REPORT_METRIC_IDS);
const CATEGORIES = new Set<string>(REPORT_EXPENSE_CATEGORIES);

export function isKnownMetricId(id: string): boolean {
  if (KNOWN.has(id)) return true;
  return id.startsWith(EXPENSE_CATEGORY_METRIC_PREFIX) && CATEGORIES.has(id.slice(EXPENSE_CATEGORY_METRIC_PREFIX.length));
}

/** Every concrete id that must have `reports.metrics.<id>.label` in both locales. */
export const ALL_LABELLED_METRIC_IDS: readonly string[] = [
  ...REPORT_METRIC_IDS,
  ...REPORT_EXPENSE_CATEGORIES.map((c) => `${EXPENSE_CATEGORY_METRIC_PREFIX}${c}`),
];

/** Exception codes the backend emits (`ReportException.code`), each with `messageKey` `reports.exception(s).<code>`. */
export const REPORT_EXCEPTION_CODES = [
  "milk.sudden_drop",
  "health.overdue_tasks",
  "health.repeated_cases",
  "reproduction.pregnancy_check_overdue",
  "reproduction.repeated_failed_services",
  "feed.low_stock_items",
  "feed.persistently_off_target",
] as const;

/** Data-quality note keys (`DataQuality.notes`) and milk reason keys, relative to the root translator. */
export const REPORT_DQ_NOTE_KEYS = [
  "reports.dq.entry_date_created_at_proxy",
  "reports.dq.estimated_values",
  "reports.dq.feed_farm_wide_totals",
  "reports.dq.group_membership_as_of_generation",
  "reports.dq.incomplete_coverage",
  "reports.dq.no_expected_data",
  "reports.dq.partial_costs",
  "reports.dq.scope_empty",
  "reports.dq.unknown_costs",
  "reports.dq.unsubmitted_drafts_excluded",
] as const;

export const REPORT_MILK_REASON_KEYS = [
  "reports.milk.no_submitted_rows",
  "reports.milk.no_rows_for_day",
  "reports.milk.no_rows_for_cow",
  "reports.milk.no_recorded_cow_days",
  "reports.milk.no_complete_data_for_drop_check",
  "reports.milk.expected_days_unknown",
] as const;

export const REPORT_SECTION_TITLE_KEYS = [
  "reports.section.milk",
  "reports.section.health",
  "reports.section.reproduction",
  "reports.section.feed",
  "reports.section.finance",
  "reports.sections.finance",
] as const;

export const REPORT_EXCEPTION_MESSAGE_KEYS = [
  "reports.exception.feed.low_stock_items",
  "reports.exception.feed.persistently_off_target",
  "reports.exception.milk.sudden_drop",
  "reports.exception.reproduction.pregnancy_check_overdue",
  "reports.exception.reproduction.repeated_failed_services",
  "reports.exceptions.health.overdue_tasks",
  "reports.exceptions.health.repeated_cases",
] as const;

/** Metric/row `source` codes (`MetricResult.source`, `BreakdownRow.source`). */
export const REPORT_SOURCES = [
  "recordedActual",
  "recordedRefusal",
  "offeredMinusRefusal",
  "distributionCost",
  "distributionCostKnownOnly",
  "ledgerFeed5000",
  "feedPlanFitDay",
  "asOfGeneration",
  "feedStockMovementFed",
  "derived",
  "cash_ledger",
  "expense_accrual",
  "vet_fee",
] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

/** Units the backend emits. Unknown units still render (raw string). */
export const REPORT_UNITS = [
  "L",
  "kg",
  "cows",
  "cow-days",
  "days",
  "%",
  "BDT",
  "BDT/cow-day",
  "BDT/L",
  "cases",
  "withdrawals",
  "items",
  "count",
] as const;
export type ReportUnit = (typeof REPORT_UNITS)[number];
