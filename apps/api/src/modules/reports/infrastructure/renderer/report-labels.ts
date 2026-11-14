/**
 * The ONE label dictionary of the PDF renderer: metric ids, section/note/exception keys and source
 * codes -> plain English. Unknown keys never throw: they fall back to a readable humanised string.
 * (English only for now; the snapshot stores keys, not text, so a locale can be added here later.)
 */

export const METRIC_LABELS: Readonly<Record<string, string>> = {
  'milk.total_yield': 'Milk collected',
  'milk.avg_daily_yield': 'Mean yield per recorded cow-day',
  'milk.cows_with_data': 'Cows with milk records',
  'milk.expected_cow_days': 'Expected cow-days',
  'milk.recorded_cow_days': 'Recorded cow-days',
  'milk.daily_yield': 'Daily milk collected',
  'milk.cow_total_yield': 'Milk total',
  'milk.cow_avg_daily_yield': 'Average per recorded day',
  'milk.cow_recorded_days': 'Recorded days',
  'milk.cow_expected_days': 'Expected days',
  'milk.top_cow_avg_yield': 'Highest average per recorded day',
  'milk.bottom_cow_avg_yield': 'Lowest average per recorded day',
  'milk.disposition_yield': 'Milk by destination',
  'milk.sudden_drop_cows': 'Cows with a sudden milk drop',
  'health.cases_opened': 'Cases opened',
  'health.cows_with_cases_opened': 'Unique animals with cases',
  'health.treatments_given': 'Treatments given',
  'health.cows_treated': 'Animals treated',
  'health.cases_closed': 'Cases closed',
  'health.cases_recovered': 'Recoveries recorded',
  'health.cases_mortality': 'Deaths recorded',
  'health.cases_open_at_period_end': 'Unresolved at period end',
  'health.preventive_tasks_completed': 'Preventive tasks completed',
  'health.preventive_tasks_missed': 'Preventive tasks missed',
  'health.tasks_overdue': 'Health follow-ups overdue',
  'health.cases_repeated': 'Repeated cases',
  'health.withdrawals_active': 'Active withdrawal periods',
  'health.treatment_cost': 'Treatment cost',
  'health.vet_fees': 'Vet fees',
  'reproduction.services_total': 'Services logged',
  'reproduction.services_ai': 'AI services',
  'reproduction.services_natural': 'Natural services',
  'reproduction.services_embryo_transfer': 'Embryo transfers',
  'reproduction.services_unique_cows': 'Animals served',
  'reproduction.outcomes_confirmed': 'Confirmed pregnancies',
  'reproduction.outcomes_pending': 'Outcomes pending',
  'reproduction.outcomes_failed': 'Failed services',
  'reproduction.outcomes_other': 'Other outcomes',
  'reproduction.services_decided': 'Services decided',
  'reproduction.conception_rate': 'Conception rate',
  'reproduction.pregnancy_checks_overdue': 'Pregnancy checks overdue',
  'reproduction.calvings': 'Calvings recorded',
  'reproduction.calves_born': 'Calves born',
  'reproduction.abortions': 'Abortions recorded',
  'reproduction.expected_calvings_30d': 'Expected calvings (30 days)',
  'reproduction.ai_cost_total': 'AI cost',
  'feed.recorded_actual_kg': 'Recorded actual feed',
  'feed.refusal_kg': 'Recorded refusal',
  'feed.offered_minus_refusal_kg': 'Offered minus refusal',
  'feed.tmr_fed_kg': 'TMR fed',
  'feed.fit_off_target_share': 'Share of cow-days off target',
  'feed.fit_estimated_cow_days': 'Cow-days with estimated fit',
  'feed.low_stock_items': 'Low-stock feed items',
  'feed.distribution_cost': 'Feed distribution cost',
  'feed.distribution_cost_known_only': 'Feed distribution cost (known only)',
  'feed.distribution_cost_coverage': 'Feed cost coverage',
  'feed.cost_per_cow_day': 'Feed cost per cow-day',
  'feed.cost_per_litre': 'Feed cost per litre',
  'feed.ledger_feed_spend': 'Feed spend (ledger)',
  'finance.cash_received': 'Cash received',
  'finance.cash_paid': 'Cash paid',
  'finance.net_cash_flow': 'Net cash flow',
  'finance.opening_cash_balance': 'Opening cash balance',
  'finance.closing_cash_balance': 'Closing cash balance',
  'finance.expenses_total': 'Expenses recorded',
};

export const KEY_LABELS: Readonly<Record<string, string>> = {
  'reports.section.milk': 'Milk',
  'reports.section.health': 'Health',
  'reports.section.reproduction': 'Breeding',
  'reports.section.feed': 'Feed',
  'reports.sections.finance': 'Cash',
  'reports.section.finance': 'Cash',
  'reports.dq.entry_date_created_at_proxy':
    'Some entry dates use the time the record was created.',
  'reports.dq.estimated_values':
    'Some figures use an estimate; they are marked in the report.',
  'reports.dq.feed_farm_wide_totals':
    'Recorded feed totals cover the whole farm, not only the selected animals.',
  'reports.dq.group_membership_as_of_generation':
    'Group members are as of the day the report was generated.',
  'reports.dq.incomplete_coverage':
    'Some expected records were not entered, so totals may be low.',
  'reports.dq.no_expected_data': 'No records were expected in this period.',
  'reports.dq.partial_costs':
    'Some costs are not linked, so totals may be low.',
  'reports.dq.scope_empty': 'No animals matched this report scope.',
  'reports.dq.unknown_costs': 'Some costs are unknown and are not counted.',
  'reports.dq.unsubmitted_drafts_excluded':
    'Unsubmitted milk drafts are excluded.',
  'reports.exception.feed.low_stock_items': 'Feed items are running low',
  'reports.exception.feed.persistently_off_target':
    'Animals persistently off their feed target',
  'reports.exception.milk.sudden_drop': 'Sudden drop in milk yield',
  'reports.exception.reproduction.pregnancy_check_overdue':
    'Pregnancy checks are overdue',
  'reports.exception.reproduction.repeated_failed_services':
    'Repeated failed services',
  'reports.exceptions.health.overdue_tasks': 'Health follow-ups are overdue',
  'reports.exceptions.health.repeated_cases': 'Repeated health cases',
  'reports.milk.no_submitted_rows': 'No submitted milk records',
  'reports.milk.no_rows_for_day': 'No record for this day',
  'reports.milk.no_rows_for_cow': 'No record in this period',
};

export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  recordedActual: 'Recorded actual',
  recordedRefusal: 'Recorded refusal',
  offeredMinusRefusal: 'Offered minus refusal, not measured intake',
  distributionCost: 'Distribution cost',
  distributionCostKnownOnly: 'Known costs only',
  ledgerFeed5000: 'Ledger feed account',
  feedPlanFitDay: 'Plan fit by day',
  asOfGeneration: 'As of report generation',
  feedStockMovementFed: 'Stock movements',
  derived: 'Derived',
  cash_ledger: 'Cash ledger',
  expense_accrual: 'Expense records',
  vet_fee: 'Vet fee',
};

/** Safe stringify for untrusted values: objects become ''. */
export function asText(v: unknown): string {
  return typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : '';
}

const KEY_SHAPE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i;

/** `milk.cow_total_yield` -> `Cow total yield`; `reports.dq.x_y` -> `X y`. Never throws. */
export function humanize(raw: unknown): string {
  const s = asText(raw).trim();
  if (!s) return '';
  const last = s.includes('.') ? s.slice(s.lastIndexOf('.') + 1) : s;
  const words = last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : s;
}

export function metricLabel(metricId: unknown): string {
  const id = asText(metricId);
  return METRIC_LABELS[id] ?? humanize(id);
}

/** Section titles, data-quality notes, exception keys, reasons: a key maps to text, free text passes through. */
export function keyLabel(key: unknown): string {
  const k = asText(key).trim();
  if (!k) return '';
  const known = KEY_LABELS[k];
  if (known) return known;
  return KEY_SHAPE.test(k) ? humanize(k) : k;
}

export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source] ?? humanize(source);
}
