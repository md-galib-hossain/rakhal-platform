/**
 * Mirrors `rakhal-backend/src/modules/reproduction` response shapes exactly, read directly from
 * `reproduction.service.ts` / `repro-protocol.service.ts` / the Prisma schema — NOT the aspirational
 * `Rakhal_API.md` §5 (which lists stale route names like `/reproduction/ai`/`/dryoff` that don't
 * exist on the real controller). `dashboard`/`events` return bespoke snake_case shapes (RAKHAL-051);
 * the six sub-resource lists (`heat-events`, `breeding-events`, `pregnancies`, `calving-events`,
 * `abortion-events`, `lactations`) are real cursor pages of raw Prisma rows (camelCase, no per-field
 * mapping) — same convention `cattleApi.calvingEvents()` already relies on. No dry-off route exists
 * yet (`DryPeriod` is schema-only, no controller endpoint) — not represented here.
 */

export type ReproductiveStatus =
  | "HEIFER"
  | "OPEN"
  | "BRED"
  | "PREGNANT"
  | "DRY"
  | "LACTATING"
  | "POSTPARTUM"
  | "ABORTED"
  | "RETIRED";

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
