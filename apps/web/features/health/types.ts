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

/** `GET /health/tasks/calendar` row shape (`health.service.ts#groupTasksByDate`) — one entry per
 * date-with-a-task in the requested month, `counts` keyed by `HealthTaskStatus`. Backs the Task Hub
 * calendar strip's per-day dot indicators (Figma 734:40931). */
export interface HealthTaskCalendarDay {
  date: string; // YYYY-MM-DD
  counts: Partial<Record<HealthTaskStatus, number>>;
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
  route: MedicineRoute | null;
  instruction: string | null;
  estimatedTime: string | null;
  milkWithdrawalDays: number | null;
  meatWithdrawalDays: number | null;
  isRequired: boolean;
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
  steps: HealthPlanStep[];
  stats: HealthPlanStats;
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
 * entry (a real, ticket-sequenced gap, not an oversight — see RFE-107's IN_FLIGHT writeup). */
export const HEALTH_MANAGEMENT_TABS = ["treatments", "schedule", "protocols"] as const;
export type HealthManagementTab = (typeof HEALTH_MANAGEMENT_TABS)[number];

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
