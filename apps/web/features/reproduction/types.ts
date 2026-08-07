/**
 * Mirrors `rakhal-backend/src/modules/reproduction` response shapes exactly, read directly from
 * `reproduction.service.ts` / `repro-protocol.service.ts` / the Prisma schema — NOT the aspirational
 * `Rakhal_API.md` §5 (which lists stale route names like `/reproduction/ai`/`/dryoff` that don't
 * exist on the real controller). `dashboard`/`events` return bespoke snake_case shapes (RAKHAL-051);
 * the six sub-resource lists (`heat-events`, `breeding-events`, `pregnancies`, `calving-events`,
 * `abortion-events`, `lactations`) are real cursor pages of raw Prisma rows (camelCase, no per-field
 * mapping) — same convention `cattleApi.calvingEvents()` already relies on. `POST
 * /reproduction/cattle/:id/dry-off` (RD-038) returns the created `DryPeriod` row directly (not a
 * cursor page — there's no GET list route for `DryPeriod` yet); RAKHAL-274 added its optional
 * `reason: DryOffReason | null` field (`create-dry-off.dto.ts` / `reproduction.prisma`, verified live).
 */

/** RAKHAL-271 v2 correction — same 5-value `ReproductionState` `features/cattle/types.ts` uses.
 * Unused within this file/module today (no import site found repo-wide as of this fix) but kept in
 * sync so it doesn't silently document a shape the backend no longer returns. */
export type ReproductiveStatus =
  | "NOT_ELIGIBLE"
  | "POSTPARTUM_WAITING"
  | "OPEN"
  | "BRED_AWAITING_CONFIRMATION"
  | "PREGNANT";

export type HeatDetectionMethod = "VISUAL" | "COLLAR_SENSOR" | "PEDOMETER" | "MANUAL";
export type BreedingMethod = "AI" | "NATURAL" | "EMBRYO_TRANSFER";
export type BreedingStatus = "PENDING_CHECK" | "PREGNANT" | "FAILED" | "ABORTED" | "CALVED";
export type PregnancyDiagnosisResult = "PREGNANT" | "NOT_PREGNANT" | "SUSPECTED";
export type PregnancyDiagnosisMethod = "ULTRASOUND" | "PALPATION" | "LAB";
export type PregnancyStatus = "ACTIVE" | "CALVED" | "ABORTED" | "FAILED";
export type CalvingEase = "NORMAL" | "ASSISTED" | "DIFFICULT" | "CESAREAN";
export type CalfBirthStatus = "ALIVE" | "STILLBORN" | "DIED_AFTER_BIRTH";
export type LactationStatus = "ACTIVE" | "ENDED";
export type ReproEventType = "heat" | "breeding" | "calving" | "abortion" | "pregnancy_diagnosis";

/** RAKHAL-274 — `DryOffReason` enum, `prisma/schemas/reproduction/reproduction.enums.prisma`. */
export type DryOffReason = "SCHEDULED" | "LOW_PRODUCTION" | "HEALTH" | "PREGNANCY" | "MANAGEMENT_DECISION";

// ---- GET /reproduction/dashboard (RAKHAL-051) ------------------------------

export interface ReproCattleRef {
  cattle_id: string;
  name: string | null;
  tag: string;
}

export interface ReproDashboardKpis {
  heat_detection_rate_pct: number | null;
  conception_rate_pct: number | null;
  pregnancy_rate_pct: number | null;
  avg_calving_interval_days: number | null;
}

export interface ReadyForAiRow extends ReproCattleRef {
  dim: number | null;
  days_open: number | null;
}

export interface InHeatNowRow extends ReproCattleRef {
  heat_observed_at: string;
}

export interface PregnancyCheckDueRow extends ReproCattleRef {
  ai_date: string;
  check_due_date: string | null;
}

export interface CalvingNext7DaysRow extends ReproCattleRef {
  expected_date: string | null;
  days_remaining: number | null;
}

export interface DryoffDue14DaysRow extends ReproCattleRef {
  dim: number;
  dryoff_target_date: string;
}

export interface ReproActionRequired {
  ready_for_ai: ReadyForAiRow[];
  in_heat_now: InHeatNowRow[];
  pregnancy_check_due: PregnancyCheckDueRow[];
  calving_next_7_days: CalvingNext7DaysRow[];
  dryoff_due_14_days: DryoffDue14DaysRow[];
}

export interface CalvingForecastRow extends ReproCattleRef {
  expected_date: string;
}

export interface OpenCowRow extends ReproCattleRef {
  dim: number | null;
  days_open: number | null;
  last_ai_date: string | null;
  vwp_end_date: string | null;
  conception_rate_pct: number | null;
}

export interface ReproDashboardResponse {
  kpis: ReproDashboardKpis;
  action_required: ReproActionRequired;
  calving_forecast_30_days: CalvingForecastRow[];
  open_cows: OpenCowRow[];
}

// ---- GET /reproduction/events (RAKHAL-051) --------------------------------

export interface ReproEventEntry {
  id: string;
  event_type: ReproEventType;
  event_date: string;
  cattle_id: string;
  cattle_name: string | null;
  cattle_tag: string;
  details: Record<string, unknown>;
}

export interface ReproEventsQuery {
  cattleId?: string;
  eventType?: ReproEventType;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

// ---- Sub-resource rows (raw Prisma shape, cursor-paginated) ---------------

export interface HeatEventRow {
  id: string;
  cattleId: string;
  heatDateTime: string;
  detectionMethod: HeatDetectionMethod;
  standingHeat: boolean;
  mucusDischarge: boolean;
  mountingBehavior: boolean;
  restlessness: boolean;
  notes: string | null;
  createdAt: string;
}

export interface BreedingEventRow {
  id: string;
  cattleId: string;
  breedingDate: string;
  breedingMethod: BreedingMethod;
  bullId: string | null;
  bull: { id: string; tagNumber: string; name: string | null } | null;
  semenBatchId: string | null;
  inseminator: string | null;
  breedingNumber: number;
  expectedPregnancyCheckDate: string | null;
  status: BreedingStatus;
  notes: string | null;
  createdAt: string;
}

export interface PregnancyRow {
  id: string;
  cattleId: string;
  breedingEventId: string | null;
  conceptionDate: string;
  expectedCalvingDate: string | null;
  actualCalvingDate: string | null;
  gestationDays: number | null;
  status: PregnancyStatus;
  createdAt: string;
}

export interface CalfBirthRow {
  id: string;
  calvingEventId: string;
  calfId: string | null;
  gender: "MALE" | "FEMALE";
  birthWeight: number | null;
  status: CalfBirthStatus;
  createdAt: string;
}

export interface CalvingEventRow {
  id: string;
  cattleId: string;
  pregnancyId: string | null;
  calvingDate: string;
  calvingNumber: number;
  calvingEase: CalvingEase;
  calfCount: number;
  placentaExpelled: boolean;
  retainedPlacenta: boolean;
  complications: string | null;
  notes: string | null;
  createdAt: string;
  calfBirths: CalfBirthRow[];
  lactations: { id: string; startDate: string; status: LactationStatus }[];
}

export interface AbortionEventRow {
  id: string;
  cattleId: string;
  pregnancyId: string | null;
  abortionDate: string;
  gestationDay: number | null;
  suspectedCause: string | null;
  notes: string | null;
  createdAt: string;
}

export interface LactationRow {
  id: string;
  cattleId: string;
  lactationNumber: number;
  calvingEventId: string | null;
  startDate: string;
  endDate: string | null;
  peakMilkDate: string | null;
  status: LactationStatus;
  createdAt: string;
  /** RAKHAL-285/290 — always present on the raw Prisma row (no `select` narrowing on the
   * `GET /reproduction/lactations` list route, verified live), just not previously typed. */
  endReason: string | null;
  recommendedDryOffAt: string | null;
  plannedDryOffAt: string | null;
}

/** `POST /reproduction/calving-events` response (RAKHAL-290) — the created `CalvingEventRow` plus,
 * when the dam still had an ACTIVE lactation (a missed dry-off), the now-auto-closed `LactationRow`
 * so the UI can surface it instead of this being a silent correction. Null in the normal case. */
export interface CreateCalvingEventResult extends CalvingEventRow {
  closedMissingDryOffLactation: LactationRow | null;
}

/** Lactation-to-date totals, split by `MilkDisposition` — `LactationStatsService`'s
 * `totalsByDisposition()` (`reproduction/domain/lactation-yield.ts`), confirmed by reading the
 * backend source directly. */
export interface LactationTotalsByDisposition {
  produced: number;
  saleable: number;
  withheld: number;
  colostrum: number;
  calfFeed: number;
  discarded: number;
  householdUse: number;
}

export interface LactationPeak {
  yieldL: number;
  date: string;
  dim: number;
}

/** `reproduction/domain/lactation-persistency.ts#computeLactationPersistency` — always returned
 * with every input value alongside the derived percentages, per that file's own doc comment, so a
 * consumer never has to show `persistencyPct` without its inputs. */
export interface LactationPersistency {
  currentSevenDayAvgYield: number;
  peakMilkYield: number;
  peakDaysInMilk: number;
  daysSincePeak: number;
  persistencyPct: number;
  declinePct: number;
}

/**
 * `GET /reproduction/lactations/:id/stats` (RAKHAL-283/284, `LactationController.getStats` →
 * `LactationStatsService.getStats`) — verified against the backend source directly, not guessed.
 * The backend also returns dry-off-projection + `standardized305DayYield` fields (RAKHAL-285/289)
 * that belong to other tickets' UI (dry-off flow, 305-day comparisons) — deliberately left off
 * this type rather than partially modeled; extend here if a future card needs them.
 */
export interface LactationStatsResponse {
  lactationId: string;
  cattleId: string;
  tagNumber: string;
  startDate: string;
  endDate: string | null;
  today: number;
  sevenDayAvgYield: number;
  thirtyDayAvgYield: number;
  lactationToDate: LactationTotalsByDisposition;
  peak: LactationPeak | null;
  persistency: LactationPersistency | null;
}

/** Return shape of `POST /reproduction/cattle/:id/dry-off` (RD-038 + RAKHAL-274's `reason`). */
export interface DryPeriodRow {
  id: string;
  cattleId: string;
  startDate: string;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  notes: string | null;
  reason: DryOffReason | null;
  createdAt: string;
}

// ---- Protocols (RAKHAL-214) ------------------------------------------------

export interface ProtocolMetrics {
  applied: number;
  in_progress: number;
  completed: number;
  ai_completed: number;
  pregnant: number;
  open: number;
  pregnancy_loss: number;
  conception_rate: number | null;
}

export interface ProtocolSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  duration_days: number;
  step_count: number;
  is_system_default: boolean;
  editable: boolean;
  metrics: ProtocolMetrics;
}

export interface ProtocolStep {
  day_number: number;
  title: string;
  step_type: string;
  instruction: string | null;
  is_required: boolean;
}

export interface ProtocolDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  duration_days: number;
  is_system_default: boolean;
  steps: ProtocolStep[];
}

export interface ProtocolKpis {
  total_applied: number;
  in_progress: number;
  completed: number;
  ai_completed: number;
  pregnant: number;
  open: number;
  pregnancy_loss: number;
  conception_rate: number | null;
  pregnancy_loss_rate: number | null;
}

export type ProtocolInstanceStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "FAILED";
export type ProtocolPregnancyOutcome = "WAITING_PD" | "PREGNANT" | "OPEN" | "PREGNANCY_LOSS" | null;

export interface ProtocolInstance {
  id: string;
  protocol_id: string;
  protocol_name: string;
  cattle_id: string;
  start_date: string;
  status: ProtocolInstanceStatus;
  current_step_day: number;
  ai_completed_at: string | null;
  pregnancy_outcome: ProtocolPregnancyOutcome;
  outcome_recorded_at: string | null;
  completed_at: string | null;
  end_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface ApplyProtocolResult {
  protocol_id: string;
  applied: number;
  tasks_created: number;
  instance_ids: string[];
}

export interface ProtocolInstanceListFilters {
  protocolId?: string;
  cattleId?: string;
  status?: ProtocolInstanceStatus;
}

// ---- Lactation curve + comparisons (RAKHAL-283/287) ------------------------

/** Per-day data-quality marker (`lactation-curve.ts`'s `buildDailyYieldSeries`) — a day is flagged
 * rather than silently zero-filled: `missing` (no session recorded), `incomplete` (some but not all
 * of the farm's configured active sessions recorded), `complete` otherwise. */
export type DimDataQuality = "complete" | "incomplete" | "missing";

export interface DailyYieldPoint {
  dim: number;
  date: string;
  yieldL: number;
  sessionsRecorded: number;
  sessionsExpected: number;
  dataQuality: DimDataQuality;
}

/** `GET /reproduction/lactations/:id/curve` (RAKHAL-283) response — `compareSeries` present only
 * when `?compareLactationId=` was passed, each series independently DIM-indexed from its own `dim=0`. */
export interface LactationCurveResponse {
  lactationId: string;
  cattleId: string;
  series: DailyYieldPoint[];
  compareLactationId: string | null;
  compareCattleId: string | null;
  compareSeries: DailyYieldPoint[] | null;
}

/** One side of `GET /reproduction/lactations/compare` (RAKHAL-287) — partial mirror of the backend's
 * `LactationComparisonSummary`, only the fields this frontend reads. */
export interface LactationComparisonSummary {
  lactationId: string;
  lactationNumber: number;
  startDate: string;
  endDate: string | null;
  dim: number;
  sevenDayAvgYield: number;
}

/** `GET /reproduction/lactations/compare?cattleId=&byLactationNumber=` — current vs. previous
 * lactation for one cow, DIM-aligned (not calendar-date aligned). `previous`/`alignedSeries`'
 * `previousYieldL` are `null` when the cow has no previous lactation yet. */
export interface LactationCompareResponse {
  cattleId: string;
  tagNumber: string;
  byLactationNumber: boolean;
  current: LactationComparisonSummary;
  previous: LactationComparisonSummary | null;
  alignedSeries: { dim: number; currentYieldL: number | null; previousYieldL: number | null }[];
}

export type LactationComparisonGroupBy = "parity" | "shed" | "feedGroup" | "dimRange";

/** One bucket of `GET /reproduction/lactations/compare/groups?groupBy=` — farm-level average
 * yield/peak/persistency across all active lactations, partitioned by `groupBy`. */
export interface LactationGroupBucketResult {
  bucketKey: string;
  bucketLabel: string;
  cowCount: number;
  avgDim: number;
  avgSevenDayYield: number;
  avgPeakMilkYield: number | null;
  avgPersistencyPct: number | null;
}
