/**
 * Reports v2 enums (RPT-01, docs/EPIC_REPORTS.md). Pure: no framework, no Prisma.
 * Idiom: `as const` array + derived union. Prisma enums for the same values land in RPT-07 and must match.
 */

export const REPORT_TYPES = ['WEEKLY', 'MONTHLY', 'ON_DEMAND'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** Who started the run. Only SCHEDULED rows take part in the idempotent unique claim. */
export const REPORT_ORIGINS = ['SCHEDULED', 'ON_DEMAND'] as const;
export type ReportOrigin = (typeof REPORT_ORIGINS)[number];

/**
 * QUEUED and PROCESSING are "pending", not failures. Only FAILED is a failure.
 * COMPLETED and FAILED are terminal; a retry never overwrites COMPLETED.
 */
export const REPORT_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_TERMINAL_STATUSES: readonly ReportStatus[] = [
  'COMPLETED',
  'FAILED',
];
export const isTerminalStatus = (s: ReportStatus): boolean =>
  REPORT_TERMINAL_STATUSES.includes(s);

export const REPORT_DOMAINS = [
  'milk',
  'health',
  'reproduction',
  'finance',
  'feed',
  'cow_profile',
] as const;
export type ReportDomain = (typeof REPORT_DOMAINS)[number];

export const REPORT_SCOPE_KINDS = [
  'SINGLE_COW',
  'GROUP',
  'ALL_ELIGIBLE',
] as const;
export type ReportScopeKind = (typeof REPORT_SCOPE_KINDS)[number];

export const DATE_PRESETS = [
  'today',
  'this_week',
  'this_month',
  'this_year',
  'custom',
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

/** Transient errors may be retried by the queue; permanent ones fail the report at once. */
export const TRANSIENT_ERROR_CATEGORIES = [
  'STORAGE_UNAVAILABLE',
  'DB_TIMEOUT',
  'QUEUE_UNAVAILABLE',
] as const;
export const PERMANENT_ERROR_CATEGORIES = [
  'INVALID_CONFIG',
  'PLAN_LIMIT',
  'PERMISSION_DENIED',
  'RENDER_FAILED',
  'GENERATION_FAILED',
] as const;
export const REPORT_ERROR_CATEGORIES = [
  ...TRANSIENT_ERROR_CATEGORIES,
  ...PERMANENT_ERROR_CATEGORIES,
] as const;
export type ReportErrorCategory = (typeof REPORT_ERROR_CATEGORIES)[number];

export function isTransientError(category: ReportErrorCategory): boolean {
  return (TRANSIENT_ERROR_CATEGORIES as readonly string[]).includes(category);
}
