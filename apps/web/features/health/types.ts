/**
 * Mirrors `rakhal-backend/src/modules/health/` (PRD §13) directly — verified against
 * `health.controller.ts`/`cattle-health.controller.ts`/`health.service.ts` and the Prisma
 * `health.prisma`/`health.enums.prisma` schemas, not the aspirational API doc. This pass builds the
 * Healthcare dashboard/sick-bay (Figma node 734:35601) + the Case Management sheet's Log Treatment,
 * Health Update, and Close Case (incl. Log Mortality sub-tab) tabs (734:37459/38378/39319/40144) +
 * the Task Hub tab (734:40931 + Record Vaccination/Task Reschedule modals) + the Health Plan tab
 * (734:45281 list + Create New Health Plan 3-step wizard 734:47059/47993/48743 + Apply Health Plan
 * Template 2-step wizard 734:49979/50881).
 */

/** RAKHAL-418: replaces the old 8-value `HealthDiagnosisType` — curative vs preventive is all the
 * backend (and every other module) distinguishes now. */
export type HealthCareType = "CURATIVE" | "PREVENTIVE";

export type HealthPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type HealthCaseStatus = "ACTIVE" | "IMPROVING" | "WORSENING" | "STABLE" | "RECOVERED" | "MORTALITY" | "CLOSED";

export type HealthActionType = "MEDICINE" | "OBSERVATION" | "VACCINATION" | "DEWORMING" | "CHECKUP" | "LAB_TEST" | "OTHER";

export type MedicineRoute = "IM" | "IV" | "SC" | "ORAL" | "TOPICAL" | "OTHER";

export type HealthTaskStatus = "PENDING" | "COMPLETED" | "MISSED" | "OVERDUE" | "SKIPPED" | "RESCHEDULED";

export type ClinicalProgress = "IMPROVING" | "WORSENING" | "STABLE";

export type AppetiteStatus = "NORMAL" | "REDUCED" | "NONE" | "HIGH";

export type AppearanceStatus = "BRIGHT" | "DULL" | "DEPRESSED" | "WEAK";

export type HealthCloseOutcome = "RECOVERED" | "MORTALITY";

/** `HealthCondition` (Prisma enum, RAKHAL-275) — a new, optional structured category layered
 * alongside the existing free-text `diagnosis` (both fields coexist on `HealthCase`, confirmed
 * against `create-health-case.dto.ts`/`update-health-case.dto.ts`). */
export type HealthCondition =
  | "MASTITIS"
  | "LAMENESS"
  | "METRITIS"
  | "KETOSIS"
  | "MILK_FEVER"
  | "FEVER"
  | "INJURY"
  | "OTHER";

/** `SafetyWithdrawalStatus` (RAKHAL-276 migration `20260805150000_rakhal_276_safety_withdrawal_status`)
 * — was `ACTIVE | COMPLETED`; `COMPLETED` renamed to `RELEASED` (only reachable via the new
 * `POST /health/safety-withdrawals/:id/release`, never a read-path side effect), plus new
 * `READY_FOR_RELEASE` (past-due, awaiting the explicit release action) and `CANCELLED`. */
export type SafetyWithdrawalStatus = "ACTIVE" | "READY_FOR_RELEASE" | "RELEASED" | "CANCELLED";

export type HealthPlanCategory = "TREATMENT" | "PREVENTION" | "BREEDING" | "VACCINATION" | "DEWORMING" | "ROUTINE";
export type HealthPlanType = "MEDICAL" | "PREVENTION" | "BREEDING" | "GENERAL";

export interface HealthCattleRef {
  id: string;
  name: string | null;
  tagNumber: string;
  image: string | null;
  status?: string;
}

export interface HealthTask {
  id: string;
  farmId: string;
  cattleId: string;
  /** Nullable since RAKHAL-415 — a preventive `PlanApplication`-derived task carries
   * `planEnrollmentId` instead and has no backing case. */
  healthCaseId: string | null;
  planEnrollmentId: string | null;
  taskCode: string;
  taskDate: string;
  dueDateTime: string;
  status: HealthTaskStatus;
  taskType: HealthActionType;
  title: string;
  instruction: string | null;
  stepNumber: number | null;
  totalSteps: number | null;
  medicineId: string | null;
  medicineName: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  route: MedicineRoute | null;
  completedAt: string | null;
  cattle?: { id: string; tagNumber: string; name: string | null };
  /** RAKHAL-470 — `GET /health/tasks` rows carry their protocol and case (null for a step that belongs to none). */
  healthPlanId?: string | null;
  healthPlan?: { id: string; name: string } | null;
  healthCase?: { id: string; caseCode: string } | null;
}

/** Filters of `GET /health/tasks` the protocol sheet uses (RAKHAL-470). `dueTo` is a farm-local `YYYY-MM-DD`. */
export interface HealthTaskFilters {
  healthPlanId?: string;
  /** Only steps that belong to no protocol. Ignored when `healthPlanId` is set. */
  noPlan?: boolean;
  statuses?: HealthTaskStatus[];
  dueTo?: string;
  sortBy?: "created" | "due";
  sortOrder?: "asc" | "desc";
}

/** One animal's run of a protocol (`GET /health/plans/:id/runs`): a case for a treatment protocol, an enrollment for a
 * preventive / breeding one. `nextStep` is the animal's soonest open step, or null when it has none left. */
export interface PlanRun {
  id: string;
  kind: "CASE" | "ENROLLMENT";
  caseCode: string | null;
  healthCaseId: string | null;
  planEnrollmentId: string | null;
  status: string;
  startDate: string;
  currentStep: number | null;
  totalSteps: number | null;
  progressPercentage: number;
  cattle: { id: string; name: string | null; tagNumber: string; image: string | null };
  nextStep: { id: string; title: string; dueDateTime: string; status: HealthTaskStatus } | null;
}

export interface TreatmentLog {
  id: string;
  cattleId: string;
  healthCaseId: string;
  healthTaskId: string | null;
  medicineId: string | null;
  medicineName: string | null;
  route: MedicineRoute | null;
  doseAmount: number | null;
  doseUnit: string | null;
  administeredAt: string;
  administeredBy: string;
  stockDeducted: boolean;
  stockDeductionQuantity: number | null;
  batchNo: string | null;
  notes: string | null;
}

export interface HealthUpdate {
  id: string;
  healthCaseId: string;
  clinicalProgress: ClinicalProgress;
  symptoms: string[];
  temperature: number | null;
  appetite: AppetiteStatus | null;
  appearance: AppearanceStatus | null;
  observation: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface SafetyWithdrawal {
  id: string;
  cattleId: string;
  healthCaseId: string;
  milkWithdrawalUntil: string | null;
  meatWithdrawalUntil: string | null;
  status: SafetyWithdrawalStatus;
  safeMilkDate: string | null;
  safeMeatDate: string | null;
}

export interface MortalityRecord {
  id: string;
  cattleId: string;
  healthCaseId: string;
  deathDate: string;
  primaryCauseOfDeath: string;
  vetSignOff: string | null;
  symptoms: string[];
  postMortemPerformed: boolean;
  disposalMethod: string | null;
  disposalCost: number | null;
  disposalLocation: string | null;
  additionalNotes: string | null;
  recordedBy: string;
}

/** `GET /health/sick-bay` row shape (`health.service.ts#getSickBay`). */
export interface HealthCaseListItem {
  id: string;
  caseCode: string;
  /** RAKHAL-418: optional free-text detail (was the required `diagnosis`). A case can have no note
   * at all — `condition` below is the primary classifier. */
  note: string | null;
  condition: HealthCondition | null;
  careType: HealthCareType;
  priority: HealthPriority;
  status: HealthCaseStatus;
  shedId: string | null;
  shedName: string | null;
  startDate: string;
  expectedRecoveryDate: string | null;
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  symptoms: string[];
  isSafetyWithholdingActive: boolean;
  cattle: HealthCattleRef;
  healthPlan: { id: string; name: string } | null;
  tasks: HealthTask[]; // next pending task, take:1
}

/** RAKHAL-415 — one animal's row inside a `PlanApplicationListItem.enrollments`. */
export interface PlanApplicationEnrollment {
  id: string;
  status: "ACTIVE" | "COMPLETED";
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  cattle: HealthCattleRef;
}

/** `GET /health/plan-applications` row (RAKHAL-415/RFE-107) — one preventive-plan "round"
 * (vaccination campaign, deworming, etc.), grouped with its enrolled animals. Replaces the removed
 * `GET /health/cases/applied` (was one row per cow, a `HealthCase` with `healthPlanId != null`) —
 * a preventive plan-apply no longer creates a `HealthCase` at all, so there is nothing left to list
 * that way. Rendered in `TreatmentsTab`'s "Preventive Rounds" section. */
export interface PlanApplicationListItem {
  id: string;
  healthPlanId: string;
  startDate: string;
  appliedBy: string;
  animalCount: number;
  healthPlan: { id: string; name: string; category: HealthPlanCategory };
  enrollments: PlanApplicationEnrollment[];
}

/** `GET /health/cases/:id` — full case detail behind "Manage Case" (`health.service.ts#getHealthCase`). */
/** `summary` on `GET /health/cases/:id` (RAKHAL-467) — the case's derived result. Absent on the other case-action
 * responses that reuse `HealthCaseDetail` (close, mortality, apply-plan, delete), hence optional on the detail type. */
export interface CaseSummary {
  /** Open: day of illness (report day = 1). Closed: elapsed days to the close date. */
  daysSick: number;
  /** Only when the case was closed as RECOVERED. */
  daysToRecover: number | null;
  outcome: "RECOVERED" | "MORTALITY" | "CLOSED" | null;
  treatmentCount: number;
  stepsDone: number;
  stepsTotal: number;
  protocol: { id: string; name: string } | null;
  /** ৳ — sum of the non-voided expenses the case's treatments posted. */
  totalCost: number;
  recurrence: {
    isRecurrence: boolean;
    previousCaseId: string | null;
    previousClosedDate: string | null;
    daysSincePrevious: number | null;
  };
}

/** `GET /health/outcomes?days=` (RAKHAL-467) — farm results over the curative cases opened in the window. Rates are
 * percentages and `null` until there is something to divide by (never a fake 0). */
export interface OutcomeBreakdown {
  cases: number;
  recovered: number;
  mortality: number;
  recoveryRate: number | null;
  avgDaysToRecover: number | null;
  avgCost: number | null;
}
/** `GET /health/morbidity-trend?days=` — curative cases opened per bucket, zero-filled. `days` omitted = all time. */
export interface MorbidityTrend {
  windowDays: number | null;
  bucket: "day" | "week" | "month";
  total: number;
  /** Cases in the equally long window just before this one; `null` for all time. */
  previousTotal: number | null;
  points: { date: string; count: number }[];
}

export interface HealthOutcomes extends OutcomeBreakdown {
  windowDays: number;
  since: string;
  openCases: number;
  /** Closed with no recorded recovery or death (e.g. protocol auto-close) — outside the recovery rate. */
  otherClosed: number;
  totalCost: number;
  recurrenceRate: number | null;
  byCondition: (OutcomeBreakdown & { condition: HealthCondition | null })[];
}

export interface HealthCaseDetail extends Omit<HealthCaseListItem, "tasks"> {
  summary?: CaseSummary;
  /** Raw `HealthCase` columns the detail row already carries (used by the Overview timeline). */
  closedDate?: string | null;
  closeReason?: string | null;
  reportedBy?: string | null;
  treatmentLogs: TreatmentLog[];
  healthUpdates: HealthUpdate[];
  tasks: HealthTask[];
  mortalityRecord: MortalityRecord | null;
  safetyWithdrawals: SafetyWithdrawal[];
  nextDose: HealthTask | null;
  lastDose: TreatmentLog | null;
  activeSafetyWithdrawal: SafetyWithdrawal | null;
}

/** `POST /health/tasks/:id/reschedule` body (`RescheduleHealthTaskDto`). */
export interface RescheduleTaskPayload {
  newDueDateTime: string;
  reason?: string;
}

/** `POST /health/tasks/:id/skip` body (`SkipHealthTaskDto`). */
export interface SkipTaskPayload {
  reason?: string;
}

export interface HealthListFilters {
  search?: string;
  cattleId?: string;
  status?: HealthCaseStatus;
  shed?: string;
  diagnosis?: string;
  priority?: HealthPriority;
}

/** `GET /health/dashboard` (`health.service.ts#getHealthDashboard`). */
export interface HealthDashboard {
  herdHealthScore: number;
  healthyAnimalCount: number;
  totalAnimalCount: number;
  sickBayCount: number;
  medicineExpense: number;
  safetyWithdrawalCount: number;
  morbidityTrend: { date: string; count: number }[];
  diseaseBreakdown: { diagnosis: string; count: number }[];
  shedWiseHealth: { shedName: string; count: number }[];
  upcomingTasksCount: number;
  overdueTasksCount: number;
}

/** `POST /health/cases` body (`CreateHealthCaseDto`) — the (out-of-Figma-scope) "Report Sickness" form. */
export interface CreateHealthCasePayload {
  cattleId: string;
  note?: string;
  condition?: HealthCondition;
  careType: HealthCareType;
  priority: HealthPriority;
  shedId?: string;
  shedName?: string;
  assignedVet?: string;
  startDate?: string;
  expectedRecoveryDate?: string;
  symptoms?: string[];
  notes?: string;
  temperature?: number;
  appetite?: AppetiteStatus;
  staffObservation?: string;
}

/** `POST /health/cases/:id/log-treatment` body (`LogTreatmentDto`) — the "Log Treatment" tab. */
export interface LogTreatmentPayload {
  healthTaskId?: string;
  medicineId?: string;
  medicineName?: string;
  doseAmount?: number;
  doseUnit?: string;
  doseUnitId?: string;
  route?: MedicineRoute;
  administeredAt?: string;
  administeredBy?: string;
  stockDeductionQuantity?: number;
  batchNo?: string;
  milkWithdrawalDays?: number;
  meatWithdrawalDays?: number;
  notes?: string;
}

/** `POST /health/tasks/:id/log-treatment` body (`LogTaskTreatmentDto`, RD-093) — the caseless
 * counterpart of `LogTreatmentPayload` for a `PlanEnrollment`-only task (no `healthTaskId` field,
 * the task id is the path param). */
export interface LogTaskTreatmentPayload {
  medicineId?: string;
  medicineName?: string;
  doseAmount?: number;
  doseUnit?: string;
  route?: MedicineRoute;
  administeredAt?: string;
  administeredBy?: string;
  stockDeductionQuantity?: number;
  batchNo?: string;
  milkWithdrawalDays?: number;
  meatWithdrawalDays?: number;
  notes?: string;
}

/** `POST /health/cases/:id/health-update` body (`CreateHealthUpdateDto`) — the "Health Update" tab. */
export interface CreateHealthUpdatePayload {
  clinicalProgress: ClinicalProgress;
  symptoms?: string[];
  temperature?: number;
  appetite?: AppetiteStatus;
  appearance?: AppearanceStatus;
  observation?: string;
  recordedBy?: string;
}

/** `POST /health/cases/:id/mortality` body (`MortalityDto`) — the "Close Case → Log Mortality" sub-tab. */
/** `POST /health/treatments` body (`RecordTreatmentDto`, RAKHAL-416) — Sick Bay's "Quick Treat":
 * logs a treatment for N animals in one call with no case id. The backend reuses each animal's
 * open case if one exists, else creates a lightweight one — never orchestrated from the frontend. */
export interface RecordTreatmentPayload {
  cattleIds: string[];
  medicineId: string;
  doseAmount: number;
  doseUnit: string;
  /** `Unit.id` of `doseUnit` — lets the backend convert the dose to the medicine's stock unit. */
  doseUnitId?: string;
  route: MedicineRoute;
  treatedAt: string;
  reason?: string;
  notes?: string;
  /** Required only when `medicine.costPerUnit * doseAmount > 0` — mirrors the same
   * RAKHAL-393/RD-066 rule `finalize-tmr-dialog.tsx` and `record-batch-dialog.tsx` already follow. */
  financialAccountId?: string;
}

export interface RecordTreatmentResultRow {
  cattleId: string;
  healthCaseId: string;
  treatmentLogId: string;
  safetyWithdrawalId: string | null;
  reusedExistingCase: boolean;
}

export interface RecordTreatmentResult {
  medicineId: string;
  appliedCount: number;
  results: RecordTreatmentResultRow[];
}

export interface MortalityPayload {
  deathDate: string;
  primaryCauseOfDeath: string;
  vetSignOff?: string;
  symptoms?: string[];
  postMortemPerformed?: boolean;
  disposalMethod?: string;
  disposalCost?: number;
  disposalLocation?: string;
  additionalNotes?: string;
  recordedBy?: string;
}

/** `POST /health/cases/:id/close` body (`CloseHealthCaseDto`) — "Close Case" tab, both outcomes. */
export interface CloseHealthCasePayload {
  outcome: HealthCloseOutcome;
  observation?: string;
  mortality?: MortalityPayload;
}

/** One row of a plan's day-wise `steps` (`HealthPlanStepDto`/Prisma `HealthPlanStep`). */
export interface HealthPlanStep {
  id: string;
  dayNumber: number;
  title: string;
  actionType: HealthActionType;
  medicineId: string | null;
  medicineName: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  /** Protocols v2 — the dose's `Unit.id` (null on legacy free-text steps). */
  doseUnitId: string | null;
  /** Protocols v2 — optional farm-local "HH:mm" the step is due. */
  timeOfDay: string | null;
  route: MedicineRoute | null;
  instruction: string | null;
  estimatedTime: string | null;
  milkWithdrawalDays: number | null;
  meatWithdrawalDays: number | null;
  isRequired: boolean;
}

/** One medicine short of usable stock for a protocol apply (`GET /health/plans/:id/stock-check`, and the
 * `details.shortfalls` of the apply 409). `needed`/`available` are in the medicine's own `unit`. */
export interface ProtocolStockShortfall {
  medicineId: string | null;
  medicineName: string;
  needed: number;
  available: number;
  unit: string;
}

/** What an undo (cancel an animal's protocol, cancel a round) did, so the toast can say it. */
export interface UndoResult {
  stepsRemoved: number;
  dosesReversed: number;
  /** A sickness case the apply had created was deleted with it. */
  caseRemoved?: boolean;
}

export interface ProtocolStockCheck {
  ok: boolean;
  shortfalls: ProtocolStockShortfall[];
}

/** Live result of a protocol (RAKHAL-466) — computed from the cases / enrollments that used it, never stored. Every
 * rate is a percentage and `null` until there is something to divide by (never a fake 0). Treatment protocols fill the
 * recovered / mortality / recoveryRate trio; prevention and breeding fill completed / due / coverageRate. */
export type HealthPlanKind = "TREATMENT" | "PREVENTION" | "BREEDING";
export interface HealthPlanStats {
  kind: HealthPlanKind;
  /** Distinct animals the protocol has been applied to. */
  appliedTo: number;
  /** Open cases (treatment) or still-active enrollments (prevention / breeding). */
  inProgress: number;
  recovered: number | null;
  mortality: number | null;
  recoveryRate: number | null;
  completed: number | null;
  /** Open steps due within 7 days, plus any already late. */
  due: number | null;
  coverageRate: number | null;
  /** RAKHAL-470 — open steps due **today** on the farm's calendar day (one per animal per step). */
  stepsDue: number;
  /** RAKHAL-470 — open steps whose day has passed. */
  stepsOverdue: number;
  /** RAKHAL-470 — farm-local `YYYY-MM-DD` of the earliest open step (may be in the past); `null` with none open. */
  nextDueDate: string | null;
}

/** `GET /health/plans` row (`health.service.ts#getPlans`) — `steps` come back on the list endpoint
 * itself (verified live), not just on a separate detail fetch, so the Figma card's Action Sequence
 * preview needs no extra request. */
export interface HealthPlanListItem {
  id: string;
  name: string;
  category: HealthPlanCategory;
  planType: HealthPlanType;
  description: string | null;
  diagnosis: string | null;
  /** RAKHAL-468 — the structured condition this protocol treats; `null` for untagged protocols. */
  condition: HealthCondition | null;
  cycleLengthDays: number | null;
  totalActionSteps: number;
  isTemplate: boolean;
  /** RAKHAL-470 — set when the protocol was deleted. Only the "In use" view returns such a row (animals are still on
   * it); the card flags it and disables Apply / Edit. */
  deletedAt?: string | null;
  steps: HealthPlanStep[];
  stats: HealthPlanStats;
}

/** Filters of `GET /health/plans` the Protocols tab uses (RFE-142). */
export interface HealthPlanFilters {
  search?: string;
  category?: HealthPlanCategory;
  planType?: HealthPlanType;
  condition?: HealthCondition;
  /** RFE-142 — the one user-facing kind, filtered on the server. */
  kind?: HealthPlanKind;
  /** RAKHAL-470 — only protocols with a run right now. */
  inUse?: boolean;
}

/** One row submitted in `CreateHealthPlanPayload.steps`/`UpdateHealthPlanPayload.steps`
 * (`HealthPlanStepDto`). */
export interface HealthPlanStepPayload {
  dayNumber: number;
  title: string;
  actionType: HealthActionType;
  medicineId?: string;
  medicineName?: string;
  doseAmount?: number;
  doseUnit?: string;
  doseUnitId?: string;
  /** "HH:mm"; omit when the step has no set time. */
  timeOfDay?: string;
  route?: MedicineRoute;
  instruction?: string;
  estimatedTime?: string;
  milkWithdrawalDays?: number;
  meatWithdrawalDays?: number;
  isRequired?: boolean;
}

/** `POST /health/plans` body (`CreateHealthPlanDto`). */
export interface CreateHealthPlanPayload {
  name: string;
  category: HealthPlanCategory;
  planType: HealthPlanType;
  description?: string;
  diagnosis?: string;
  /** `null` clears it on update. */
  condition?: HealthCondition | null;
  cycleLengthDays?: number;
  isTemplate?: boolean;
  steps: HealthPlanStepPayload[];
}

/** `PATCH /health/plans/:id` body (`UpdateHealthPlanDto`) — same shape, all optional. */
export type UpdateHealthPlanPayload = Partial<CreateHealthPlanPayload>;

/** `POST /health/cases/:id/apply-plan` body (`ApplyHealthPlanDto`) — applies to one existing case.
 * For applying to N animals at once (creating a case per animal as needed), use
 * `ApplyPlanToAnimalsPayload`/`healthApi.applyPlanToAnimals` instead (RAKHAL-414). */
export interface ApplyHealthPlanPayload {
  healthPlanId: string;
  startDate?: string;
}

/** `POST /health/plans/:id/apply` body (`ApplyPlanToAnimalsDto`, RAKHAL-414) — the real bulk-apply
 * route: one call per selection instead of the old create-case-then-apply loop, one per animal. */
export interface ApplyPlanToAnimalsPayload {
  cattleIds: string[];
  startDate?: string;
}

/** One row of `ApplyPlanToAnimalsResult.results` — an animal already on this exact protocol comes
 * back `skipped` (with `reason`) rather than getting a duplicate case. */
export interface ApplyPlanToAnimalsResultRow {
  cattleId: string;
  status: "applied" | "skipped";
  healthCaseId?: string;
  reason?: string;
}

export interface ApplyPlanToAnimalsResult {
  healthPlanId: string;
  appliedCount: number;
  skippedCount: number;
  results: ApplyPlanToAnimalsResultRow[];
}

/** RFE-107 — "3 tabs, not 4": `sickBay` and the Health Plan tab's Active Plans section collapse
 * into `treatments`; `taskHub` is relabeled `schedule` (RFE-109's own deferred rename, landing
 * here); `healthPlan` becomes `protocols` (plan catalog only, Active Plans moved out). The
 * `safetyWithdrawals` tab is retired here — RFE-110 folds its capability into `treatments` as a
 * filter chip rather than a peer tab; until RFE-110 ships, Safety Withdrawals has no dedicated nav
 * entry (a real, ticket-sequenced gap, not an oversight — see RFE-107's IN_FLIGHT writeup).
 * RFE-140 (MILESTONE 29c) adds `insights` (the trend chart + outcomes moved off the top of the page). The keys stay
 * stable so old links keep working: `treatments` is labelled "Sick Bay". RFE-143 removed the `schedule` ("Care steps") tab —
 * its steps are recorded from the protocol sheet; an old `?healthTab=schedule` link is mapped to `protocols`
 * (`parseHealthTab`). */
export const HEALTH_MANAGEMENT_TABS = ["treatments", "protocols", "insights"] as const;
export type HealthManagementTab = (typeof HEALTH_MANAGEMENT_TABS)[number];

/** RFE-141 — the Sick Bay tab shows ONE paged list at a time: animals under treatment, animals whose milk/meat is
 * withheld (a closed case can still have a running withdrawal). Lives in the URL as `?bay=` so the stat strip and
 * links can open the right one. (RFE-143 removed the third view, preventive rounds - they are in the protocol sheet.) */
export const SICK_BAY_VIEWS = ["cases", "withheld"] as const;
export type SickBayView = (typeof SICK_BAY_VIEWS)[number];

/** `GET /health/safety-withdrawals` row shape (`health.service.ts#getSafetyWithdrawals`) — the
 * backend include for `cattle` was added alongside this frontend tab (previously had zero UI
 * consumer despite the route existing). RFE-110/RAKHAL-420 added `medicineName`/`caseCode`/
 * `{milk,meat}DaysRemaining` (server-computed countdown, not diffed client-side against `until`). */
export interface SafetyWithdrawalListItem extends SafetyWithdrawal {
  cattle: HealthCattleRef;
  medicineName: string | null;
  caseCode: string;
  milkDaysRemaining: number | null;
  meatDaysRemaining: number | null;
}

/** RFE-135: `overview` (summary + timeline + what-next + result) is the default tab; the other three are the
 * existing action tabs. */
export const CASE_MANAGE_TABS = ["overview", "logTreatment", "healthUpdate", "closeCase"] as const;
export type CaseManageTab = (typeof CASE_MANAGE_TABS)[number];

/** Figma's "Signs & Symptoms" chip set (Health Update + Close Case → Log Mortality tabs, both
 * 734:38378 and 734:40144 use the identical 8-chip set) — free-text `symptoms: string[]` on the
 * backend (the `value` is what's actually sent), so this is a curated quick-pick list, not a closed
 * enum. `key` is a slug-safe i18n key (avoids "/" and spaces as JSON keys). */
export const SYMPTOM_OPTIONS: { value: string; key: string }[] = [
  { value: "Limping/Lameness", key: "limpingLameness" },
  { value: "Coughing", key: "coughing" },
  { value: "Diarrhea", key: "diarrhea" },
  { value: "Eye Discharge", key: "eyeDischarge" },
  { value: "Udder Swelling", key: "udderSwelling" },
  { value: "Nasal Discharge", key: "nasalDischarge" },
  { value: "Fever", key: "fever" },
];

export const MEDICINE_ROUTES: MedicineRoute[] = ["IM", "IV", "SC", "ORAL"];

/** `POST /health/cases/bulk` body (`BulkCreateHealthCasesDto`, RAKHAL-469) — one condition for several animals (an
 * outbreak). One of `condition` / `note` is required by the backend; the Report Sickness form always sends a condition. */
export interface BulkCreateHealthCasesPayload {
  cattleIds: string[];
  condition?: HealthCondition;
  note?: string;
  careType?: HealthCareType;
  priority: HealthPriority;
  assignedVet?: string;
  startDate?: string;
  expectedRecoveryDate?: string;
  symptoms?: string[];
  notes?: string;
}

/** One animal's outcome in a bulk report: a case was opened, or the animal already had an open case for the condition. */
export type BulkCreateHealthCaseResult =
  | { cattleId: string; status: "created"; healthCaseId: string; caseCode: string }
  | { cattleId: string; status: "skipped"; reason: string };

export interface BulkCreateHealthCasesResult {
  createdCount: number;
  skippedCount: number;
  results: BulkCreateHealthCaseResult[];
}

/** `GET /cattle/:id/protocols` row — one protocol one animal is on now: a treatment protocol running on an open case
 * (`runType: "CASE"`) or a preventive / breeding round (`"ENROLLMENT"`). Exactly one of the two ids is set. */
export interface CattleProtocolRun {
  runType: "CASE" | "ENROLLMENT";
  /** The run's own id (the case id or the enrollment id). */
  id: string;
  healthCaseId: string | null;
  planEnrollmentId: string | null;
  caseCode: string | null;
  healthPlan: { id: string; name: string; category: HealthPlanCategory };
  startDate: string;
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  nextStep: { id: string; title: string; dueDateTime: string; status: "PENDING" | "RESCHEDULED" | "OVERDUE" } | null;
}

/** `POST /cattle/:id/protocols/stop` — exactly one of the two ids. */
export interface StopCattleProtocolPayload {
  healthCaseId?: string;
  planEnrollmentId?: string;
  reason?: string;
}

// ── Protocol rounds (RAKHAL-471/472, MILESTONE 29d — docs/EPIC_PROTOCOL_ROUNDS.md) ─────────────────────────────────

export type RoundStatus = "RUNNING" | "FINISHED";

/** `GET /health/rounds` row — one application of a protocol on one farm day. A real `PlanApplication` for preventive /
 * breeding protocols; for treatment, the cases of one protocol whose steps were created the same farm day (RD-116). */
export interface ProtocolRound {
  /** Opaque: `app:<applicationId>` or `trt:<planId>:<yyyy-mm-dd>`. Always URL-encode it in a path. */
  roundKey: string;
  healthPlan: { id: string; name: string; category: HealthPlanCategory; deletedAt: string | null };
  kind: HealthPlanKind;
  /** The farm-local `YYYY-MM-DD` the protocol was applied. */
  startDate: string;
  animalCount: number;
  /** Steps that are not skipped. */
  stepsTotal: number;
  stepsDone: number;
  stepsSkipped: number;
  stepsOverdue: number;
  stepsDueToday: number;
  /** Farm-local `YYYY-MM-DD` of the earliest live open step, or null. */
  nextDueDate: string | null;
  status: RoundStatus;
}

export interface RoundFilters {
  status?: RoundStatus;
  kind?: HealthPlanKind;
  search?: string;
  healthPlanId?: string;
}

/** `inactive` = an open step whose animal left the herd or whose case / enrollment stopped — neither due nor late. */
export type RoundCellState = "done" | "skipped" | "inactive" | "overdue" | "today" | "upcoming";

export interface RoundGridCell {
  taskId: string;
  state: RoundCellState;
  /** `due - today` in farm days (negative = late). */
  days: number;
  title: string;
  status: HealthTaskStatus;
  stepNumber: number | null;
  dueDate: string;
  doneAt: string | null;
}

export interface RoundGridColumn {
  key: string;
  stepNumber: number | null;
  dayNumber: number | null;
  title: string;
}

export interface RoundGridRow {
  runKey: string;
  runType: "CASE" | "ENROLLMENT";
  healthCaseId: string | null;
  planEnrollmentId: string | null;
  caseCode: string | null;
  cattle: { id: string; name: string | null; tagNumber: string };
  dueCount: number;
  overdueCount: number;
  cells: Record<string, RoundGridCell>;
}

/** `GET /health/rounds/:roundKey/grid` — `data`; the cursor `meta` pages the `rows` (animals). */
export interface RoundGridData {
  round: ProtocolRound;
  columns: RoundGridColumn[];
  rows: RoundGridRow[];
}

/** `POST /health/rounds/:roundKey/animals` result (RAKHAL-473). `applied` rows carry the new enrollment (preventive /
 * breeding round) or case (treatment round); `skipped` rows are animals already on the protocol. */
export interface AddRoundAnimalsResult {
  roundKey: string;
  addedCount: number;
  skippedCount: number;
  results: Array<
    | { cattleId: string; status: "applied"; planEnrollmentId?: string; healthCaseId?: string }
    | { cattleId: string; status: "skipped"; reason: string }
  >;
}
