import { ApiProperty } from '@nestjs/swagger';
import {
  AppearanceStatus,
  AppetiteStatus,
  ClinicalProgress,
  HealthActionType,
  HealthCareType,
  HealthCaseStatus,
  HealthCondition,
  HealthPlanCategory,
  HealthPlanType,
  HealthPriority,
  HealthTaskStatus,
  HerdStatus,
  MedicineRoute,
  SafetyWithdrawalStatus,
  type Prisma,
} from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { HealthService } from '../../application/services/health.service';

/**
 * Documented response shapes for the health routes typed under RD-140. Each class mirrors what the
 * service really returns and is pinned to it by a compile-time guard at the bottom of this file, so a
 * change in the service (or a Prisma column) fails `nest build` until this file follows.
 * `Date` fields are ISO-8601 strings on the wire; `Decimal` fields are strings.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

// ─── Health case (POST /health/cases, PATCH /health/cases/:id) ──────────────

export class HealthCaseCattleBriefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty() tagNumber!: string;
  @ApiProperty({ type: String, nullable: true }) image!: string | null;
  @ApiProperty({ enum: HerdStatus, enumName: 'HerdStatus' })
  herdStatus!: HerdStatus;
}

export class HealthCasePlanBriefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

/** The bare `HealthCase` row, without the cattle/plan joins. */
export class HealthCaseRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() caseCode!: string;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({
    enum: HealthCondition,
    enumName: 'HealthCondition',
    nullable: true,
  })
  condition!: HealthCondition | null;
  @ApiProperty({ enum: HealthCareType, enumName: 'HealthCareType' })
  careType!: HealthCareType;
  @ApiProperty({ enum: HealthPriority, enumName: 'HealthPriority' })
  priority!: HealthPriority;
  @ApiProperty({ enum: HealthCaseStatus, enumName: 'HealthCaseStatus' })
  status!: HealthCaseStatus;
  @ApiProperty({ type: String, nullable: true }) shedId!: string | null;
  @ApiProperty({ type: String, nullable: true }) shedName!: string | null;
  @ApiProperty({ type: String, nullable: true }) reportedBy!: string | null;
  @ApiProperty({ type: String, nullable: true }) assignedVet!: string | null;
  @ApiProperty(DATE_TIME) startDate!: Date;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  expectedRecoveryDate!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) closedDate!: Date | null;
  @ApiProperty({ type: String, nullable: true }) closeReason!: string | null;
  @ApiProperty({ type: String, nullable: true }) mortalityId!: string | null;
  @ApiProperty({ type: String, nullable: true }) healthPlanId!: string | null;
  @ApiProperty() currentStep!: number;
  @ApiProperty() totalSteps!: number;
  @ApiProperty() progressPercentage!: number;
  @ApiProperty({ type: [String] }) symptoms!: string[];
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: String, nullable: true }) photoUrl!: string | null;
  @ApiProperty() isSafetyWithholdingActive!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  milkWithdrawalUntil!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  meatWithdrawalUntil!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class HealthCaseResponseDto extends HealthCaseRowDto {
  @ApiProperty({ type: () => HealthCaseCattleBriefDto })
  cattle!: HealthCaseCattleBriefDto;
  @ApiProperty({ type: () => HealthCasePlanBriefDto, nullable: true })
  healthPlan!: HealthCasePlanBriefDto | null;
}

// ─── Treatment (POST /health/treatments, POST /health/treatments/:id/void) ──

export class RecordTreatmentResultDto {
  @ApiProperty() cattleId!: string;
  @ApiProperty() healthCaseId!: string;
  @ApiProperty() treatmentLogId!: string;
  @ApiProperty({ type: String, nullable: true })
  safetyWithdrawalId!: string | null;
  @ApiProperty() reusedExistingCase!: boolean;
}

export class RecordTreatmentResponseDto {
  @ApiProperty({
    type: String,
    required: false,
    description:
      'Absent when the treatment is not tied to an inventory medicine.',
  })
  medicineId!: string | undefined;
  @ApiProperty() appliedCount!: number;
  @ApiProperty({ type: () => [RecordTreatmentResultDto] })
  results!: RecordTreatmentResultDto[];
}

export class VoidTreatmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() voided!: boolean;
}

// ─── Safety withdrawals ────────────────────────────────────────────────────

export class RefreshSafetyWithdrawalsResponseDto {
  @ApiProperty({ description: 'How many withdrawals were re-evaluated.' })
  updated!: number;
}

export class SafetyWithdrawalResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() healthCaseId!: string;
  @ApiProperty({
    enum: SafetyWithdrawalStatus,
    enumName: 'SafetyWithdrawalStatus',
  })
  status!: SafetyWithdrawalStatus;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  milkWithdrawalUntil!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  meatWithdrawalUntil!: Date | null;
  @ApiProperty({ type: String, nullable: true }) medicineId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  treatmentLogId!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) safeMilkDate!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) safeMeatDate!: Date | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

// ─── Health task (POST /health/tasks/:id/{complete,skip,reschedule}) ────────

export class HealthTaskResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty({ type: String, nullable: true }) healthCaseId!: string | null;
  @ApiProperty({ enum: HealthTaskStatus, enumName: 'HealthTaskStatus' })
  status!: HealthTaskStatus;
  @ApiProperty({ type: String, nullable: true }) healthPlanId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) totalSteps!: number | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) medicineId!: string | null;
  @ApiProperty({ type: String, nullable: true }) medicineName!: string | null;
  @ApiProperty({
    enum: MedicineRoute,
    enumName: 'MedicineRoute',
    nullable: true,
  })
  route!: MedicineRoute | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Decimal, serialised as a string.',
  })
  doseAmount!: Prisma.Decimal | null;
  @ApiProperty({ type: String, nullable: true }) doseUnit!: string | null;
  @ApiProperty({ type: String, nullable: true })
  planEnrollmentId!: string | null;
  @ApiProperty() taskCode!: string;
  @ApiProperty(DATE_TIME) taskDate!: Date;
  @ApiProperty(DATE_TIME) dueDateTime!: Date;
  @ApiProperty({ enum: HealthActionType, enumName: 'HealthActionType' })
  taskType!: HealthActionType;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) instruction!: string | null;
  @ApiProperty({ type: Number, nullable: true }) stepNumber!: number | null;
  @ApiProperty({ type: String, nullable: true }) doseUnitId!: string | null;
  @ApiProperty({ type: String, nullable: true }) timeOfDay!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) completedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) completedBy!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  rescheduledFrom!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) rescheduledTo!: Date | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

// ─── Stock check (GET /health/plans/:id/stock-check) ────────────────────────

export class StockShortfallDto {
  @ApiProperty({ type: String, nullable: true }) medicineId!: string | null;
  @ApiProperty() medicineName!: string;
  @ApiProperty() needed!: number;
  @ApiProperty() available!: number;
  @ApiProperty() unit!: string;
}

export class StockCheckResponseDto {
  @ApiProperty({
    description: 'True when every medicine the plan needs is in stock.',
  })
  ok!: boolean;
  @ApiProperty({ type: () => [StockShortfallDto] })
  shortfalls!: StockShortfallDto[];
}

// ─── Dashboard (GET /health/dashboard) ──────────────────────────────────────

export class HealthMorbidityPointDto {
  @ApiProperty({ description: 'Day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty() count!: number;
}

export class HealthDiseaseCountDto {
  @ApiProperty() diagnosis!: string;
  @ApiProperty() count!: number;
}

export class HealthShedCountDto {
  @ApiProperty() shedName!: string;
  @ApiProperty() count!: number;
}

export class HealthDashboardResponseDto {
  @ApiProperty() herdHealthScore!: number;
  @ApiProperty() healthyAnimalCount!: number;
  @ApiProperty() totalAnimalCount!: number;
  @ApiProperty() sickBayCount!: number;
  @ApiProperty() medicineExpense!: number;
  @ApiProperty() safetyWithdrawalCount!: number;
  @ApiProperty({ type: () => [HealthMorbidityPointDto] })
  morbidityTrend!: HealthMorbidityPointDto[];
  @ApiProperty({ type: () => [HealthDiseaseCountDto] })
  diseaseBreakdown!: HealthDiseaseCountDto[];
  @ApiProperty({ type: () => [HealthShedCountDto] })
  shedWiseHealth!: HealthShedCountDto[];
  @ApiProperty() upcomingTasksCount!: number;
  @ApiProperty() overdueTasksCount!: number;
}

// ─── Bulk report (POST /health/cases/bulk) ──────────────────────────────────

export class HealthBulkCaseResultDto {
  @ApiProperty() cattleId!: string;
  @ApiProperty({ enum: ['created', 'skipped'] })
  status!: 'created' | 'skipped';
  @ApiProperty({ type: String, required: false, description: 'Created only.' })
  healthCaseId?: string;
  @ApiProperty({ type: String, required: false, description: 'Created only.' })
  caseCode?: string;
  @ApiProperty({
    type: String,
    required: false,
    description: 'Skipped only: why the animal was not reported.',
  })
  reason?: string;
}

export class HealthBulkCasesResponseDto {
  @ApiProperty() createdCount!: number;
  @ApiProperty() skippedCount!: number;
  @ApiProperty({ type: () => [HealthBulkCaseResultDto] })
  results!: HealthBulkCaseResultDto[];
}

// ─── Case actions ───────────────────────────────────────────────────────────

export class HealthUpdateResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() healthCaseId!: string;
  @ApiProperty({ type: [String] }) symptoms!: string[];
  @ApiProperty(DATE_TIME) recordedAt!: Date;
  @ApiProperty({ enum: ClinicalProgress, enumName: 'ClinicalProgress' })
  clinicalProgress!: ClinicalProgress;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal string.' })
  temperature!: Prisma.Decimal | null;
  @ApiProperty({
    enum: AppetiteStatus,
    enumName: 'AppetiteStatus',
    nullable: true,
  })
  appetite!: AppetiteStatus | null;
  @ApiProperty({
    enum: AppearanceStatus,
    enumName: 'AppearanceStatus',
    nullable: true,
  })
  appearance!: AppearanceStatus | null;
  @ApiProperty({ type: String, nullable: true }) observation!: string | null;
  @ApiProperty() recordedBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class HealthApplyPlanResponseDto {
  @ApiProperty({ type: () => HealthCaseResponseDto })
  healthCase!: HealthCaseResponseDto;
  @ApiProperty({ type: () => [HealthTaskResponseDto] })
  tasks!: HealthTaskResponseDto[];
}

export class HealthTreatmentLogRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() healthCaseId!: string;
  @ApiProperty({ type: String, nullable: true }) healthTaskId!: string | null;
  @ApiProperty({ type: String, nullable: true }) medicineId!: string | null;
  @ApiProperty({ type: String, nullable: true }) medicineName!: string | null;
  @ApiProperty({
    enum: MedicineRoute,
    enumName: 'MedicineRoute',
    nullable: true,
  })
  route!: MedicineRoute | null;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal string.' })
  doseAmount!: Prisma.Decimal | null;
  @ApiProperty({ type: String, nullable: true }) doseUnit!: string | null;
  @ApiProperty(DATE_TIME) administeredAt!: Date;
  @ApiProperty() administeredBy!: string;
  @ApiProperty() stockDeducted!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal string.' })
  stockDeductionQuantity!: Prisma.Decimal | null;
  @ApiProperty({ type: String, nullable: true }) batchNo!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: String, nullable: true })
  financeTransactionId!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal string.' })
  vetCost!: Prisma.Decimal | null;
  @ApiProperty({ type: String, nullable: true }) vetExpenseId!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) voidedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) voidedBy!: string | null;
  @ApiProperty({ type: String, nullable: true }) voidReason!: string | null;
  @ApiProperty({ type: String, nullable: true })
  animalEventId!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class HealthAutoClosedCaseDto {
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() caseCode!: string;
}

/** POST /health/tasks/:id/log-treatment. */
export class HealthTaskTreatmentResponseDto {
  @ApiProperty({ type: () => HealthTreatmentLogRowDto })
  treatmentLog!: HealthTreatmentLogRowDto;
  @ApiProperty({ type: () => SafetyWithdrawalResponseDto, nullable: true })
  withdrawal!: SafetyWithdrawalResponseDto | null;
}

/** POST /health/cases/:id/log-treatment. */
export class HealthLogTreatmentResponseDto extends HealthTaskTreatmentResponseDto {
  @ApiProperty({
    type: () => HealthAutoClosedCaseDto,
    nullable: true,
    description:
      'Set when this treatment finished the last step and closed the case.',
  })
  autoClosed!: HealthAutoClosedCaseDto | null;
}

export class HealthMortalityRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() healthCaseId!: string;
  @ApiProperty({ type: String, nullable: true })
  animalEventId!: string | null;
  @ApiProperty() recordedBy!: string;
  @ApiProperty(DATE_TIME) deathDate!: Date;
  @ApiProperty() primaryCauseOfDeath!: string;
  @ApiProperty({ type: [String] }) symptoms!: string[];
  @ApiProperty({ type: String, nullable: true }) vetSignOff!: string | null;
  @ApiProperty() postMortemPerformed!: boolean;
  @ApiProperty({ type: String, nullable: true })
  disposalMethod!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal string.' })
  disposalCost!: Prisma.Decimal | null;
  @ApiProperty({ type: String, nullable: true })
  disposalLocation!: string | null;
  @ApiProperty({ type: String, nullable: true })
  additionalNotes!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class HealthMortalityResponseDto {
  @ApiProperty({ type: () => HealthMortalityRowDto })
  mortality!: HealthMortalityRowDto;
  @ApiProperty({ type: () => HealthCaseRowDto })
  healthCase!: HealthCaseRowDto;
}

// ─── Plan (DELETE /health/plans/:id) ────────────────────────────────────────

export class HealthPlanRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: HealthPlanCategory, enumName: 'HealthPlanCategory' })
  category!: HealthPlanCategory;
  @ApiProperty({ enum: HealthPlanType, enumName: 'HealthPlanType' })
  planType!: HealthPlanType;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) diagnosis!: string | null;
  @ApiProperty({
    enum: HealthCondition,
    enumName: 'HealthCondition',
    nullable: true,
  })
  condition!: HealthCondition | null;
  @ApiProperty({ type: Number, nullable: true })
  cycleLengthDays!: number | null;
  @ApiProperty() totalActionSteps!: number;
  @ApiProperty() isTemplate!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

// ─── Lists: safety withdrawals, tasks, task calendar ────────────────────────

export class HealthCattleTagDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty() tagNumber!: string;
}

export class HealthCattleBriefDto extends HealthCattleTagDto {
  @ApiProperty({ type: String, nullable: true }) image!: string | null;
}

export class HealthCaseCodeDto {
  @ApiProperty() caseCode!: string;
}

export class HealthCaseRefDto extends HealthCaseCodeDto {
  @ApiProperty() id!: string;
}

export class HealthTreatmentMedicineDto {
  @ApiProperty({ type: String, nullable: true }) medicineName!: string | null;
}

/** One row of GET /health/safety-withdrawals. */
export class SafetyWithdrawalListItemDto extends SafetyWithdrawalResponseDto {
  @ApiProperty({ type: String, nullable: true }) medicineName!: string | null;
  @ApiProperty() caseCode!: string;
  @ApiProperty({ type: Number, nullable: true })
  milkDaysRemaining!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  meatDaysRemaining!: number | null;
  @ApiProperty({ type: () => HealthCattleBriefDto })
  cattle!: HealthCattleBriefDto;
  @ApiProperty({ type: () => HealthCaseCodeDto })
  healthCase!: HealthCaseCodeDto;
  @ApiProperty({ type: () => HealthTreatmentMedicineDto, nullable: true })
  treatmentLog!: HealthTreatmentMedicineDto | null;
}

/** One row of GET /health/tasks. */
export class HealthTaskListItemDto extends HealthTaskResponseDto {
  @ApiProperty({ type: () => HealthCattleTagDto })
  cattle!: HealthCattleTagDto;
  @ApiProperty({ type: () => HealthCaseRefDto, nullable: true })
  healthCase!: HealthCaseRefDto | null;
  @ApiProperty({ type: () => HealthCasePlanBriefDto, nullable: true })
  healthPlan!: HealthCasePlanBriefDto | null;
}

/** One day of GET /health/tasks/calendar. */
export class HealthTaskCalendarDayDto {
  @ApiProperty({ description: 'Day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Task count per HealthTaskStatus that has tasks that day.',
  })
  counts!: Record<string, number>;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
// Each fails `nest build` if the service's real return type and the documented class diverge.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<K extends keyof HealthService> = HealthService[K] extends (
  ...args: never[]
) => infer R
  ? Awaited<R>
  : never;

export type HealthShapeGuards = [
  Assert<Same<Ret<'createHealthCase'>, HealthCaseResponseDto>>,
  Assert<Same<Ret<'updateHealthCase'>, HealthCaseResponseDto>>,
  Assert<Same<Ret<'recordTreatment'>, RecordTreatmentResponseDto>>,
  Assert<Same<Ret<'voidTreatmentLog'>, VoidTreatmentResponseDto>>,
  Assert<
    Same<Ret<'refreshSafetyWithdrawals'>, RefreshSafetyWithdrawalsResponseDto>
  >,
  Assert<Same<Ret<'releaseWithdrawal'>, SafetyWithdrawalResponseDto>>,
  Assert<Same<Ret<'completeTask'>, HealthTaskResponseDto>>,
  Assert<Same<Ret<'skipTask'>, HealthTaskResponseDto>>,
  Assert<Same<Ret<'rescheduleTask'>, HealthTaskResponseDto>>,
  Assert<Same<Ret<'stockCheck'>, StockCheckResponseDto>>,
  Assert<Same<Ret<'getHealthDashboard'>, HealthDashboardResponseDto>>,
  // The bulk result is a discriminated union in the service; the documented class is its flat view.
  Assert<
    Ret<'createHealthCasesBulk'> extends HealthBulkCasesResponseDto
      ? true
      : false
  >,
  Assert<Same<Ret<'deleteCase'>, HealthCaseRowDto>>,
  Assert<Same<Ret<'createHealthUpdate'>, HealthUpdateResponseDto>>,
  Assert<Same<Ret<'applyHealthPlanToCase'>, HealthApplyPlanResponseDto>>,
  Assert<Same<Ret<'logTreatment'>, HealthLogTreatmentResponseDto>>,
  Assert<Same<Ret<'logTaskTreatment'>, HealthTaskTreatmentResponseDto>>,
  Assert<Same<Ret<'logMortality'>, HealthMortalityResponseDto>>,
  Assert<Same<Ret<'deletePlan'>, HealthPlanRowDto>>,
  Assert<
    Same<Ret<'getSafetyWithdrawals'>, CursorPage<SafetyWithdrawalListItemDto>>
  >,
  Assert<Same<Ret<'getTasks'>, CursorPage<HealthTaskListItemDto>>>,
  Assert<Same<Ret<'getTaskCalendar'>, HealthTaskCalendarDayDto[]>>,
];
