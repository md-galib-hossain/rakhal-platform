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
  PlanEnrollmentStatus,
  SafetyWithdrawalStatus,
  type Prisma,
} from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { HealthOutcomesService } from '../../application/services/health-outcomes.service';
import type { HealthRoundsService } from '../../application/services/health-rounds.service';
import type { PlanStats } from '../../domain/health-plan-stats';
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

// ─── Lists: treatments, plan applications ───────────────────────────────────

export class HealthTreatmentCaseBriefDto {
  @ApiProperty() id!: string;
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
}

/** One row of GET /health/treatments. */
export class HealthTreatmentListItemDto extends HealthTreatmentLogRowDto {
  @ApiProperty({ type: () => HealthCattleBriefDto })
  cattle!: HealthCattleBriefDto;
  @ApiProperty({ type: () => HealthTreatmentCaseBriefDto })
  healthCase!: HealthTreatmentCaseBriefDto;
}

export class HealthPlanApplicationPlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: HealthPlanCategory, enumName: 'HealthPlanCategory' })
  category!: HealthPlanCategory;
}

export class HealthPlanEnrollmentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: () => HealthCattleBriefDto })
  cattle!: HealthCattleBriefDto;
  @ApiProperty({
    enum: PlanEnrollmentStatus,
    enumName: 'PlanEnrollmentStatus',
  })
  status!: PlanEnrollmentStatus;
  @ApiProperty() currentStep!: number;
  @ApiProperty() totalSteps!: number;
  @ApiProperty() progressPercentage!: number;
}

/** One row of GET /health/plan-applications. */
export class HealthPlanApplicationDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() healthPlanId!: string;
  @ApiProperty(DATE_TIME) startDate!: Date;
  @ApiProperty() appliedBy!: string;
  @ApiProperty() animalCount!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty({ type: () => HealthPlanApplicationPlanDto })
  healthPlan!: HealthPlanApplicationPlanDto;
  @ApiProperty({ type: () => [HealthPlanEnrollmentDto] })
  enrollments!: HealthPlanEnrollmentDto[];
}

// ─── Outcomes + morbidity trend ─────────────────────────────────────────────

export class HealthOutcomeBreakdownDto {
  @ApiProperty() cases!: number;
  @ApiProperty() recovered!: number;
  @ApiProperty() mortality!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Percent, one decimal; null until a case has an outcome.',
  })
  recoveryRate!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  avgDaysToRecover!: number | null;
  @ApiProperty({ type: Number, nullable: true }) avgCost!: number | null;
}

export class HealthOutcomeByConditionDto extends HealthOutcomeBreakdownDto {
  @ApiProperty({ type: String, nullable: true }) condition!: string | null;
}

export class HealthOutcomesResponseDto extends HealthOutcomeBreakdownDto {
  @ApiProperty() openCases!: number;
  @ApiProperty() otherClosed!: number;
  @ApiProperty() totalCost!: number;
  @ApiProperty({ type: Number, nullable: true }) recurrenceRate!: number | null;
  @ApiProperty({ type: () => [HealthOutcomeByConditionDto] })
  byCondition!: HealthOutcomeByConditionDto[];
  @ApiProperty() windowDays!: number;
  @ApiProperty(DATE_TIME) since!: Date;
}

export class HealthTrendPointDto {
  @ApiProperty({ description: 'First day of the bucket, YYYY-MM-DD.' })
  date!: string;
  @ApiProperty() count!: number;
}

export class HealthMorbidityTrendResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty({ type: Number, nullable: true })
  previousTotal!: number | null;
  @ApiProperty({ enum: ['day', 'week', 'month'] })
  bucket!: 'day' | 'week' | 'month';
  @ApiProperty({ type: () => [HealthTrendPointDto] })
  points!: HealthTrendPointDto[];
  @ApiProperty({ type: Number, nullable: true }) windowDays!: number | null;
}

// ─── Plan create (POST /health/plans) ───────────────────────────────────────

export class HealthPlanStepDto {
  @ApiProperty() id!: string;
  @ApiProperty() healthPlanId!: string;
  @ApiProperty() dayNumber!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: HealthActionType, enumName: 'HealthActionType' })
  actionType!: HealthActionType;
  @ApiProperty({ type: String, nullable: true }) medicineId!: string | null;
  @ApiProperty({ type: String, nullable: true }) medicineName!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal string.' })
  doseAmount!: Prisma.Decimal | null;
  @ApiProperty({ type: String, nullable: true }) doseUnit!: string | null;
  @ApiProperty({ type: String, nullable: true }) doseUnitId!: string | null;
  @ApiProperty({
    enum: MedicineRoute,
    enumName: 'MedicineRoute',
    nullable: true,
  })
  route!: MedicineRoute | null;
  @ApiProperty({ type: String, nullable: true }) timeOfDay!: string | null;
  @ApiProperty({ type: String, nullable: true }) instruction!: string | null;
  @ApiProperty({ type: String, nullable: true })
  estimatedTime!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  milkWithdrawalDays!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  meatWithdrawalDays!: number | null;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class HealthPlanWithStepsDto extends HealthPlanRowDto {
  @ApiProperty({ type: () => [HealthPlanStepDto] })
  steps!: HealthPlanStepDto[];
}

// ─── Rounds: add animals, cancel ────────────────────────────────────────────

export class HealthRoundAnimalResultDto {
  @ApiProperty() cattleId!: string;
  @ApiProperty({ enum: ['applied', 'skipped'] })
  status!: 'applied' | 'skipped';
  @ApiProperty({
    type: String,
    required: false,
    description: 'Applied, protocol rounds only.',
  })
  planEnrollmentId?: string;
  @ApiProperty({
    type: String,
    required: false,
    description: 'Applied, treatment rounds only.',
  })
  healthCaseId?: string;
  @ApiProperty({ type: String, required: false, description: 'Skipped only.' })
  reason?: string;
}

export class HealthRoundAddAnimalsResponseDto {
  @ApiProperty() roundKey!: string;
  @ApiProperty() addedCount!: number;
  @ApiProperty() skippedCount!: number;
  @ApiProperty({ type: () => [HealthRoundAnimalResultDto] })
  results!: HealthRoundAnimalResultDto[];
}

export class HealthRoundCancelResponseDto {
  @ApiProperty() roundKey!: string;
  @ApiProperty() animals!: number;
  @ApiProperty() stepsRemoved!: number;
  @ApiProperty() dosesReversed!: number;
  @ApiProperty() casesRemoved!: number;
}

// ─── Case detail (GET /health/cases/:id) ────────────────────────────────────

export class HealthCaseRecurrenceDto {
  @ApiProperty() isRecurrence!: boolean;
  @ApiProperty({ type: String, nullable: true })
  previousCaseId!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  previousClosedDate!: Date | null;
  @ApiProperty({ type: Number, nullable: true })
  daysSincePrevious!: number | null;
}

export class HealthCaseSummaryDto {
  @ApiProperty() daysSick!: number;
  @ApiProperty({ type: Number, nullable: true }) daysToRecover!: number | null;
  @ApiProperty({
    enum: HealthCaseStatus,
    enumName: 'HealthCaseStatus',
    nullable: true,
  })
  outcome!: HealthCaseStatus | null;
  @ApiProperty() treatmentCount!: number;
  @ApiProperty() stepsDone!: number;
  @ApiProperty() stepsTotal!: number;
  @ApiProperty({ type: () => HealthCasePlanBriefDto, nullable: true })
  protocol!: HealthCasePlanBriefDto | null;
  @ApiProperty() totalCost!: number;
  @ApiProperty({ type: () => HealthCaseRecurrenceDto })
  recurrence!: HealthCaseRecurrenceDto;
}

export class HealthCaseDetailResponseDto extends HealthCaseRowDto {
  @ApiProperty({ type: () => HealthCaseSummaryDto })
  summary!: HealthCaseSummaryDto;
  @ApiProperty({ type: () => HealthTaskResponseDto, nullable: true })
  nextDose!: HealthTaskResponseDto | null;
  @ApiProperty({
    type: () => HealthTreatmentLogRowDto,
    nullable: true,
    description: 'Most recent treatment; null when none was given yet.',
  })
  lastDose!: HealthTreatmentLogRowDto;
  @ApiProperty({
    type: () => SafetyWithdrawalResponseDto,
    nullable: true,
    description: 'Most recent withdrawal; null when the case has none.',
  })
  activeSafetyWithdrawal!: SafetyWithdrawalResponseDto;
  @ApiProperty({ type: () => HealthCaseCattleBriefDto })
  cattle!: HealthCaseCattleBriefDto;
  @ApiProperty({ type: () => HealthCasePlanBriefDto, nullable: true })
  healthPlan!: HealthCasePlanBriefDto | null;
  @ApiProperty({ type: () => [HealthTaskResponseDto] })
  tasks!: HealthTaskResponseDto[];
  @ApiProperty({ type: () => [HealthTreatmentLogRowDto] })
  treatmentLogs!: HealthTreatmentLogRowDto[];
  @ApiProperty({ type: () => [HealthUpdateResponseDto] })
  healthUpdates!: HealthUpdateResponseDto[];
  @ApiProperty({ type: () => HealthMortalityRowDto, nullable: true })
  mortalityRecord!: HealthMortalityRowDto | null;
  @ApiProperty({ type: () => [SafetyWithdrawalResponseDto] })
  safetyWithdrawals!: SafetyWithdrawalResponseDto[];
}

// ─── Sick bay (GET /health/sick-bay) ────────────────────────────────────────

/** One row of GET /health/sick-bay: the case plus its open tasks and cattle. */
export class HealthSickBayItemDto extends HealthCaseRowDto {
  @ApiProperty({ type: Number, nullable: true })
  withdrawalDaysLeft!: number | null;
  @ApiProperty({ type: () => HealthCattleBriefDto })
  cattle!: HealthCattleBriefDto;
  @ApiProperty({ type: () => HealthCasePlanBriefDto, nullable: true })
  healthPlan!: HealthCasePlanBriefDto | null;
  @ApiProperty({ type: () => [HealthTaskResponseDto] })
  tasks!: HealthTaskResponseDto[];
}

// ─── Plans list / detail (live stats attached by the controller) ────────────

export class HealthPlanStatsDto {
  @ApiProperty({ enum: ['TREATMENT', 'PREVENTION', 'BREEDING'] })
  kind!: 'TREATMENT' | 'PREVENTION' | 'BREEDING';
  @ApiProperty({ description: 'Open steps due today.' }) stepsDue!: number;
  @ApiProperty({ description: 'Open steps whose due day has passed.' })
  stepsOverdue!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Farm-local YYYY-MM-DD of the earliest open step.',
  })
  nextDueDate!: string | null;
  @ApiProperty({ description: 'Distinct animals the protocol was applied to.' })
  appliedTo!: number;
  @ApiProperty({ description: 'Open cases (treatment) or active enrollments.' })
  inProgress!: number;
  @ApiProperty({ type: Number, nullable: true }) recovered!: number | null;
  @ApiProperty({ type: Number, nullable: true }) mortality!: number | null;
  @ApiProperty({ type: Number, nullable: true }) recoveryRate!: number | null;
  @ApiProperty({ type: Number, nullable: true }) completed!: number | null;
  @ApiProperty({ type: Number, nullable: true }) due!: number | null;
  @ApiProperty({ type: Number, nullable: true }) coverageRate!: number | null;
}

/** One row of GET /health/plans and the body of GET /health/plans/:id. */
export class HealthPlanListItemDto extends HealthPlanWithStepsDto {
  @ApiProperty({ type: () => HealthPlanStatsDto })
  stats!: HealthPlanStatsDto;
}

// ─── Plan runs (GET /health/plans/:id/runs) ─────────────────────────────────

export class HealthRunNextStepDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: HealthTaskStatus, enumName: 'HealthTaskStatus' })
  status!: HealthTaskStatus;
  @ApiProperty(DATE_TIME) dueDateTime!: Date;
  @ApiProperty() title!: string;
}

/** One animal running a protocol: an open case (treatment) or an enrollment (prevention / breeding). */
export class HealthPlanRunDto {
  @ApiProperty({ enum: ['CASE', 'ENROLLMENT'] })
  kind!: 'CASE' | 'ENROLLMENT';
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) healthCaseId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  planEnrollmentId!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Cases only.' })
  caseCode!: string | null;
  @ApiProperty({
    type: String,
    description:
      'HealthCaseStatus for a case, PlanEnrollmentStatus for an enrollment.',
  })
  status!: string;
  @ApiProperty(DATE_TIME) startDate!: Date;
  @ApiProperty() currentStep!: number;
  @ApiProperty() totalSteps!: number;
  @ApiProperty() progressPercentage!: number;
  @ApiProperty({ type: () => HealthCattleBriefDto })
  cattle!: HealthCattleBriefDto;
  @ApiProperty({ type: () => HealthRunNextStepDto })
  nextStep!: HealthRunNextStepDto;
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

type OutRet<K extends keyof HealthOutcomesService> =
  HealthOutcomesService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;

type RoundsRet<K extends keyof HealthRoundsService> =
  HealthRoundsService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;

export type HealthShapeGuards = [
  Assert<
    Same<
      Omit<Ret<'getHealthCase'>, 'summary'>,
      Omit<HealthCaseDetailResponseDto, 'summary'>
    >
  >,
  Assert<
    Ret<'getHealthCase'>['summary'] extends HealthCaseSummaryDto ? true : false
  >,
  Assert<Same<Ret<'closeCase'>, HealthCaseRowDto | HealthMortalityResponseDto>>,
  Assert<Same<Ret<'getSickBay'>, CursorPage<HealthSickBayItemDto>>>,
  Assert<Same<Ret<'getPlans'>, CursorPage<HealthPlanWithStepsDto>>>,
  Assert<Same<Ret<'getPlanForView'>, HealthPlanWithStepsDto>>,
  Assert<Same<PlanStats, HealthPlanStatsDto>>,
  Assert<
    Ret<'getPlanRuns'> extends CursorPage<HealthPlanRunDto> ? true : false
  >,
  Assert<Same<RoundsRet<'cancelRound'>, HealthRoundCancelResponseDto>>,
  Assert<
    RoundsRet<'addAnimals'> extends HealthRoundAddAnimalsResponseDto
      ? true
      : false
  >,
  Assert<Same<OutRet<'getOutcomes'>, HealthOutcomesResponseDto>>,
  Assert<
    OutRet<'getMorbidityTrend'> extends HealthMorbidityTrendResponseDto
      ? true
      : false
  >,
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
  Assert<Same<Ret<'createPlan'>, HealthPlanWithStepsDto>>,
  Assert<Same<Ret<'getTreatmentLogs'>, CursorPage<HealthTreatmentListItemDto>>>,
  Assert<
    Same<Ret<'getPlanApplications'>, CursorPage<HealthPlanApplicationDto>>
  >,
];
