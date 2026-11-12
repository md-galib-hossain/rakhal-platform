/**
 * Reports v2 wire contract (RFE-153). Mirrors the backend source of truth, never guessed:
 *   `rakhal-backend/src/modules/reports/domain/contracts/*.ts` (enums, period, scope, metric-value,
 *   data-quality, snapshot, template) and `application/api/reports-api.{types,constants}.ts`.
 * Dates arrive as ISO strings (JSON), never `Date`.
 */

/* ----------------------------------------------------------------- enums */

export const REPORT_TYPES = ["WEEKLY", "MONTHLY", "ON_DEMAND"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_ORIGINS = ["SCHEDULED", "ON_DEMAND"] as const;
export type ReportOrigin = (typeof REPORT_ORIGINS)[number];

export const REPORT_STATUSES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_DOMAINS = ["milk", "health", "reproduction", "finance", "feed", "cow_profile"] as const;
export type ReportDomain = (typeof REPORT_DOMAINS)[number];

export const REPORT_SCOPE_KINDS = ["SINGLE_COW", "GROUP", "ALL_ELIGIBLE"] as const;
export type ReportScopeKind = (typeof REPORT_SCOPE_KINDS)[number];

export const DATE_PRESETS = ["today", "this_week", "this_month", "this_year", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const REPORT_ERROR_CATEGORIES = [
  "STORAGE_UNAVAILABLE",
  "DB_TIMEOUT",
  "QUEUE_UNAVAILABLE",
  "INVALID_CONFIG",
  "PLAN_LIMIT",
  "PERMISSION_DENIED",
  "RENDER_FAILED",
  "GENERATION_FAILED",
] as const;
export type ReportErrorCategory = (typeof REPORT_ERROR_CATEGORIES)[number];

/** Backend `ReportApiReason` values (`details.reason` on a 4xx). Keep in sync with reports-api.constants.ts. */
export const REPORT_API_REASONS = [
  "REPORT_NO_METRICS",
  "REPORT_TOO_MANY_METRICS",
  "REPORT_METRIC_NOT_ALLOWED",
  "REPORT_FINANCE_FORBIDDEN",
  "REPORT_INVALID_TEMPLATE",
  "REPORT_INVALID_SCOPE",
  "REPORT_INVALID_PERIOD",
  "REPORT_INVALID_IDEMPOTENCY_KEY",
  "REPORT_IDEMPOTENCY_CONFLICT",
  "REPORT_TOO_MANY_IN_FLIGHT",
  "REPORT_PDF_NOT_AVAILABLE",
  "REPORT_NOT_RETRYABLE",
  "REPORT_RETRY_LIMIT",
  "REPORT_OWNER_ONLY",
  "REPORT_TEMPLATE_UNAVAILABLE",
  "REPORT_PROCESSING",
  "REPORT_PREVIEW_BUSY",
  "REPORT_QUEUE_UNAVAILABLE",
  "REPORT_STORAGE_UNAVAILABLE",
] as const;
export type ReportApiReasonCode = (typeof REPORT_API_REASONS)[number];

/** Backend `PeriodErrorCode` forwarded as `details.code` alongside REPORT_INVALID_PERIOD. */
export const PERIOD_ERROR_CODES = [
  "INVALID_TIMEZONE",
  "INVALID_DATE",
  "INVALID_RANGE",
  "RANGE_TOO_LONG",
  "PERIOD_KIND_MISMATCH",
  "INVALID_PRESET",
] as const;
export type PeriodErrorCode = (typeof PERIOD_ERROR_CODES)[number];

/** Limits shared with the backend (`MAX_SELECTED_METRICS`, `MAX_CUSTOM_RANGE_DAYS`, `MAX_IDEMPOTENCY_KEY_LENGTH`). */
export const MAX_SELECTED_METRICS = 60;
export const MAX_CUSTOM_RANGE_DAYS = 366;
export const MAX_RAW_METRIC_IDS = 200;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
/** Alias the backend accepts for "the current on-demand template" in `templateId`. */
export const ON_DEMAND_TEMPLATE_ALIAS = "on-demand";

/* ----------------------------------------------------------- period/scope */

/** Resolved period (snapshot / summary). `startDate`/`endDate` are farm-local YYYY-MM-DD, both inclusive. */
export interface ReportPeriod {
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  timezone: string;
  label: string;
}

/** Period as stored on a report row (`ReportSummary.period`). */
export interface ReportSummaryPeriod {
  startDate: string;
  endDate: string;
  timezone: string;
}

/** Period as *requested*. */
export interface ReportPeriodInput {
  preset: DatePreset;
  customStartDate?: string;
  customEndDate?: string;
}

export type ReportScope =
  | { kind: "SINGLE_COW"; cattleId: string }
  | { kind: "GROUP"; groupId: string; membershipAsOf: string }
  | { kind: "ALL_ELIGIBLE" };

/** Scope as *requested*: ids only, no `membershipAsOf`. */
export type ReportScopeInput =
  | { kind: "SINGLE_COW"; cattleId: string }
  | { kind: "GROUP"; groupId: string }
  | { kind: "ALL_ELIGIBLE" };

/* ----------------------------------------------------------------- metrics */

export type MetricValueState = "value" | "missing" | "not_calculated" | "not_applicable";

/** Four explicit states. A missing figure is NEVER representable as 0. */
export type MetricValue =
  | { state: "value"; value: number; unit: string }
  | { state: "missing"; reason: string }
  | { state: "not_calculated"; reason: string }
  | { state: "not_applicable" };

export type ValueMetric = Extract<MetricValue, { state: "value" }>;

export interface Comparison {
  current: MetricValue;
  previous: MetricValue;
  absoluteChange: number | null;
  /** null when previous is 0 / not a value, or current is not a value. */
  percentChange: number | null;
  previousState: MetricValueState;
}

export interface SeriesPoint {
  /** Stable key, e.g. a farm-local YYYY-MM-DD. */
  key: string;
  value: MetricValue;
}

export interface BreakdownRow {
  key: string;
  label: string | null;
  value: MetricValue;
  source: string | null;
}

/** `<domain>.<name>` (e.g. `milk.total_yield`). */
export type MetricId = `${ReportDomain}.${string}`;

export interface MetricResult {
  metricId: MetricId;
  value: MetricValue;
  /** e.g. `offeredMinusRefusal` | `recordedActual` | `ledgerFeed5000`. See `sourceLabelKey`. */
  source: string | null;
  comparison: Comparison | null;
  series?: SeriesPoint[];
  rows?: BreakdownRow[];
  requiresPermission: string | null;
}

/* ----------------------------------------------------------------- snapshot */

export interface DataQualityFlags {
  incompleteCoverage: boolean;
  hasUnsubmittedDrafts: boolean;
  hasEstimatedValues: boolean;
  hasUnknownCosts: boolean;
  groupMembershipCurrentOnly: boolean;
}

export interface DataQuality {
  coverage: { expected: number; recorded: number };
  /** i18n keys like `reports.dq.incomplete_coverage` (free text possible: see `backendKeyOrText`). */
  notes: string[];
  flags: DataQualityFlags;
}

export interface SnapshotSection {
  id: string;
  domain: ReportDomain;
  /** i18n key, e.g. `reports.section.milk`. */
  titleKey: string;
  metrics: MetricResult[];
}

export interface ReportException {
  /** e.g. `milk.sudden_drop`. */
  code: string;
  domain: ReportDomain;
  /** i18n key, e.g. `reports.exception.milk.sudden_drop`. */
  messageKey: string;
  cattleIds?: string[];
}

export interface ReportSnapshotPayload {
  schemaVersion: number;
  reportType?: ReportType;
  calcVersion: number;
  templateVersion: number;
  farm: { id: string; name: string; timezone: string; logoKey?: string | null };
  period: ReportPeriod;
  previousPeriod?: ReportPeriod;
  scope: ReportScope;
  generatedAt: string;
  includesFinance: boolean;
  sections: SnapshotSection[];
  exceptions: ReportException[];
  dataQuality: DataQuality;
}

/* --------------------------------------------------------------- templates */

export interface TemplateMetric {
  id: MetricId;
  unit: string;
  /** Full i18n path `reports.metrics.<id>.label` (valid under the root translator). */
  labelKey: string;
  definitionKey: string;
  requiresFinance: boolean;
}

export interface TemplateSection {
  id: string;
  domain: ReportDomain;
  titleKey: string;
  metrics: TemplateMetric[];
}

/** `GET /reports/templates`. Finance metrics/sections are already absent for callers without `finance.read`. */
export interface ReportTemplatesResponse {
  onDemand: {
    id: string;
    alias: typeof ON_DEMAND_TEMPLATE_ALIAS;
    version: number;
    domains: ReportDomain[];
    sections: TemplateSection[];
  };
  scheduled: {
    weekly: { version: number } | null;
    monthly: { version: number } | null;
  };
  datePresets: DatePreset[];
  scopeKinds: ReportScopeKind[];
  limits: { maxMetrics: number; maxCustomRangeDays: number };
}

/* ------------------------------------------------------------ report DTOs */

export interface ReportSummary {
  id: string;
  type: ReportType;
  origin: ReportOrigin;
  status: ReportStatus;
  templateVersion: number | null;
  period: ReportSummaryPeriod;
  scope: ReportScope;
  selectedMetricIds: string[];
  includesFinance: boolean;
  hasPdf: boolean;
  pdfBytes: number | null;
  attempts: number;
  errorCategory: ReportErrorCategory | null;
  /** Backend-localized text, capped at 200 chars. Prefer `errorCategory` + i18n. */
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface ReportDetail extends ReportSummary {
  /** Present only when COMPLETED. */
  payload: ReportSnapshotPayload | null;
}

/* ------------------------------------------------------------- requests */

export interface PreviewReportRequest {
  templateId: string;
  period: ReportPeriodInput;
  scope: ReportScopeInput;
  selectedMetricIds: string[];
  compare?: boolean;
}

export interface CreateReportRequest extends PreviewReportRequest {
  /** Create a new snapshot even if an identical report already exists. */
  forceNew?: boolean;
}

/** Raw `POST /reports` body: 201 = new, 200 = replay of the same Idempotency-Key or a duplicate. */
export type CreateReportResponse =
  | { duplicate: false; replayed: boolean; report: ReportSummary }
  | { duplicate: true; existing: ReportSummary };

/** What `useCreateReport` resolves with. `replayed` = same Idempotency-Key answered again (still the same report). */
export type CreateReportResult =
  | { kind: "created"; report: ReportSummary; replayed: boolean }
  | { kind: "duplicate"; existing: ReportSummary };

export interface ReportListFilters {
  type?: ReportType;
  origin?: ReportOrigin;
  status?: ReportStatus;
}

export interface ReportDownload {
  blob: Blob;
  /** Parsed from Content-Disposition; falls back to `report-<id>.pdf`. */
  filename: string;
}

/* ------------------------------------------------------------- type guards */

export const isValueMetric = (v: MetricValue): v is ValueMetric => v.state === "value";
export const isMissingMetric = (v: MetricValue): v is Extract<MetricValue, { state: "missing" }> =>
  v.state === "missing";
export const isNotCalculatedMetric = (v: MetricValue): v is Extract<MetricValue, { state: "not_calculated" }> =>
  v.state === "not_calculated";
export const isNotApplicableMetric = (v: MetricValue): v is Extract<MetricValue, { state: "not_applicable" }> =>
  v.state === "not_applicable";

export const isTerminalStatus = (status: ReportStatus): boolean => status === "COMPLETED" || status === "FAILED";
export const isPendingStatus = (status: ReportStatus): boolean => status === "QUEUED" || status === "PROCESSING";

export const isCreateDuplicate = (r: CreateReportResponse): r is Extract<CreateReportResponse, { duplicate: true }> =>
  r.duplicate === true;

export const isReportApiReason = (v: unknown): v is ReportApiReasonCode =>
  typeof v === "string" && (REPORT_API_REASONS as readonly string[]).includes(v);

/** Single-source helpers for scope narrowing. */
export const isSingleCowScope = (s: ReportScope): s is Extract<ReportScope, { kind: "SINGLE_COW" }> =>
  s.kind === "SINGLE_COW";
export const isGroupScope = (s: ReportScope): s is Extract<ReportScope, { kind: "GROUP" }> => s.kind === "GROUP";
