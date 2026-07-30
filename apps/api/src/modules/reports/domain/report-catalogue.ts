/**
 * Report catalogue (PRD §22.2). The single source of truth for the 12 MVP
 * reports + the Feed Cost report (RD-013) — used by `GET /reports` (metadata)
 * and to validate `reportId` on generate. Pure data; no framework/Prisma imports.
 */

export type ReportCategory =
  | 'production'
  | 'reproduction'
  | 'health'
  | 'financial'
  | 'combined';

export type ReportParamKey =
  | 'date'
  | 'month'
  | 'year'
  | 'shedId'
  | 'cattleId'
  | 'fromDate'
  | 'toDate';

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  formats: ('pdf' | 'csv')[];
  version: 'MVP';
  frequency: 'on_demand';
  /** Parameters the generator reads (drives the UI form; informational here). */
  params: ReportParamKey[];
}

const ALL_FORMATS: ('pdf' | 'csv')[] = ['pdf', 'csv'];

export const REPORTS: ReportDef[] = [
  // Production
  {
    id: 'rpt_daily_milk',
    name: 'Daily Milk Production',
    description:
      'Per cow and per shed totals for a day, vs yesterday and the 7-day average, with anomalies flagged.',
    category: 'production',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['date', 'shedId'],
  },
  {
    id: 'rpt_monthly_production',
    name: 'Monthly Production Summary',
    description:
      'Total yield, per-cow average, sellable vs withholding split, and cost per litre for a month.',
    category: 'production',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['month'],
  },
  {
    id: 'rpt_cow_history',
    name: 'Individual Cow Production History',
    description:
      'Lifetime yield by year, lactation cycles, and health events for a single cow.',
    category: 'production',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['cattleId'],
  },
  // Reproduction
  {
    id: 'rpt_repro_summary',
    name: 'Monthly Reproduction Summary',
    description:
      'Calvings, AIs, conception rate, open cows, and calving-interval distribution for a month.',
    category: 'reproduction',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['month'],
  },
  {
    id: 'rpt_open_cows',
    name: 'Open Cow Report',
    description:
      'All open cows with days open, last AI date, and recommended action.',
    category: 'reproduction',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: [],
  },
  {
    id: 'rpt_calving_forecast',
    name: 'Calving Forecast (30-day)',
    description:
      'Expected calvings in the next 30 days with dam, expected date, and DIM at expected calving.',
    category: 'reproduction',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: [],
  },
  // Health
  {
    id: 'rpt_weekly_health',
    name: 'Weekly Herd Health Report',
    description:
      'New cases, treatments, recoveries, withholding status, and medicine costs for a week.',
    category: 'health',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['fromDate', 'toDate'],
  },
  {
    id: 'rpt_vaccination_compliance',
    name: 'Vaccination Compliance Report',
    description:
      'Per animal: vaccines given with dates, plus upcoming and overdue vaccinations.',
    category: 'health',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: [],
  },
  {
    id: 'rpt_withholding_compliance',
    name: 'Withholding Compliance Report',
    description:
      'All withholding events: cow, medicine, start and end dates, and milk excluded.',
    category: 'health',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: [],
  },
  // Financial
  {
    id: 'rpt_monthly_pl',
    name: 'Monthly P&L',
    description:
      'Income vs expenses, net profit, and cost per litre for a month, vs last month.',
    category: 'financial',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['month'],
  },
  {
    id: 'rpt_buyer_reconciliation',
    name: 'Buyer Reconciliation Statement',
    description:
      'Per buyer: dispatched vs received vs paid vs outstanding for a month.',
    category: 'financial',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['month'],
  },
  {
    id: 'rpt_annual_herd_inventory',
    name: 'Annual Herd Inventory',
    description:
      'Opening count, additions, removals, closing count, and estimated value for a year.',
    category: 'financial',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['year'],
  },
  {
    id: 'rpt_feed_cost',
    name: 'Feed Cost Report',
    description:
      'Feed (forage) spend for a month vs litres produced: feed cost per litre, feed as a share of total expense, cost per cow per day, and a per-item breakdown.',
    category: 'financial',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['month'],
  },
  // Combined
  {
    id: 'rpt_monthly_farm_report',
    name: 'Monthly Farm Report',
    description:
      'Combined Cattle, Milk, Health, and Finance summary for one farm and month in a single document.',
    category: 'combined',
    formats: ALL_FORMATS,
    version: 'MVP',
    frequency: 'on_demand',
    params: ['month'],
  },
];

export const REPORT_IDS = new Set(REPORTS.map((r) => r.id));

export function isKnownReport(reportId: string): boolean {
  return REPORT_IDS.has(reportId);
}

/** Catalogue grouped by category, for `GET /reports`. */
export function groupedCatalogue(): {
  category: ReportCategory;
  reports: ReportDef[];
}[] {
  const order: ReportCategory[] = [
    'production',
    'reproduction',
    'health',
    'financial',
    'combined',
  ];
  return order.map((category) => ({
    category,
    reports: REPORTS.filter((r) => r.category === category),
  }));
}
