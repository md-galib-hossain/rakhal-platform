import { ApiProperty } from '@nestjs/swagger';
import {
  HealthActionType,
  HealthCareType,
  HealthCaseStatus,
  HealthCondition,
  HealthPriority,
  HealthTaskStatus,
  HerdStatus,
  MedicineRoute,
  SafetyWithdrawalStatus,
  type Prisma,
} from '@prisma/client';
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

export class HealthCaseResponseDto {
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
];
