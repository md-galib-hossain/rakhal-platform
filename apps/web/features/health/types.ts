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

export type HealthDiagnosisType =
  | "DISEASE"
  | "INJURY"
  | "VACCINATION"
  | "DEWORMING"
  | "ROUTINE_CHECKUP"
  | "PREVENTIVE"
  | "BREEDING_RELATED"
  | "OTHER";

export type HealthPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type HealthCaseStatus = "ACTIVE" | "IMPROVING" | "WORSENING" | "STABLE" | "RECOVERED" | "MORTALITY" | "CLOSED";

export type HealthActionType = "MEDICINE" | "OBSERVATION" | "VACCINATION" | "DEWORMING" | "CHECKUP" | "LAB_TEST" | "OTHER";

export type MedicineRoute = "IM" | "IV" | "SC" | "ORAL" | "TOPICAL" | "OTHER";

export type HealthTaskStatus = "PENDING" | "COMPLETED" | "MISSED" | "OVERDUE" | "SKIPPED" | "RESCHEDULED";

export type ClinicalProgress = "IMPROVING" | "WORSENING" | "STABLE";

export type AppetiteStatus = "NORMAL" | "REDUCED" | "NONE" | "HIGH";

export type AppearanceStatus = "BRIGHT" | "DULL" | "DEPRESSED" | "WEAK";

export type HealthCloseOutcome = "RECOVERED" | "MORTALITY";

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
  healthCaseId: string;
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
  status: "ACTIVE" | "COMPLETED";
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
  diagnosis: string;
  diagnosisType: HealthDiagnosisType;
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

/** `GET /health/cases/:id` — full case detail behind "Manage Case" (`health.service.ts#getHealthCase`). */
export interface HealthCaseDetail extends Omit<HealthCaseListItem, "tasks"> {
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
  diagnosis: string;
  diagnosisType: HealthDiagnosisType;
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
  cycleLengthDays: number | null;
  totalActionSteps: number;
  isTemplate: boolean;
  steps: HealthPlanStep[];
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
  cycleLengthDays?: number;
  isTemplate?: boolean;
  steps: HealthPlanStepPayload[];
}

/** `PATCH /health/plans/:id` body (`UpdateHealthPlanDto`) — same shape, all optional. */
export type UpdateHealthPlanPayload = Partial<CreateHealthPlanPayload>;

/** `POST /health/cases/:id/apply-plan` body (`ApplyHealthPlanDto`) — applies to one existing case
 * (the backend has no bulk/shed-wide apply endpoint, see `apply-health-plan-dialog.tsx` doc comment). */
export interface ApplyHealthPlanPayload {
  healthPlanId: string;
  startDate?: string;
}

export const HEALTH_MANAGEMENT_TABS = ["sickBay", "taskHub", "healthPlan", "safetyWithdrawals"] as const;
export type HealthManagementTab = (typeof HEALTH_MANAGEMENT_TABS)[number];

/** `GET /health/safety-withdrawals` row shape (`health.service.ts#getSafetyWithdrawals`) — the
 * backend include for `cattle` was added alongside this frontend tab (previously had zero UI
 * consumer despite the route existing). */
export interface SafetyWithdrawalListItem extends SafetyWithdrawal {
  cattle: HealthCattleRef;
}

export const CASE_MANAGE_TABS = ["logTreatment", "healthUpdate", "closeCase"] as const;
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
