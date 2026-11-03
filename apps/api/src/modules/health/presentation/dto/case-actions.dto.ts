import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  AppetiteStatus,
  AppearanceStatus,
  ClinicalProgress,
  HealthCareType,
  HealthCloseOutcome,
  HealthCondition,
  MedicineRoute,
} from '@prisma/client';
import { toBoolean } from 'src/common/dto';
import { trimString } from './common.dto';

export class ApplyHealthPlanDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  healthPlanId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class LogTreatmentDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  healthTaskId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  medicineId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  medicineName?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  doseAmount?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  doseUnit?: string;

  /** `Unit.id` the typed `doseAmount` is expressed in; converted to the medicine's own stock unit when deducting. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  doseUnitId?: string;

  @IsOptional()
  @IsEnum(MedicineRoute)
  route?: MedicineRoute;

  @IsOptional()
  @IsDateString()
  administeredAt?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  administeredBy?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  stockDeductionQuantity?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchNo?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  milkWithdrawalDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  meatWithdrawalDays?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** Medicine typed by hand (not in Inventory): `medicineName` is stored as given, no stock is deducted and no
   * medicine cost is posted. Needs `medicineName`; ignores `medicineId`. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  outsideInventory?: boolean;

  /** Vet fee for this treatment, in ৳. Posted as a HEALTH expense paid from `financialAccountId`
   * (required when `vetCost` > 0). Unrelated to the medicine's inventory consumption cost. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  vetCost?: number;

  /** Wallet/account the vet fee is paid from. Only read when `vetCost` > 0 (RD-084: the medicine's own
   * consumption cost never touches cash, so it is still not read for that). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;
}

/**
 * RD-093 — `POST /health/tasks/:id/log-treatment`, the caseless counterpart of `LogTreatmentDto`.
 * The task id comes from the path (a `PlanEnrollment`'s `HealthTask`, not a case-scoped one — the
 * route itself rejects a task that still has a `healthCaseId`), so there is no `healthTaskId` field
 * here; everything else mirrors `LogTreatmentDto` field-for-field.
 */
export class LogTaskTreatmentDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  medicineId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  medicineName?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  doseAmount?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  doseUnit?: string;

  @IsOptional()
  @IsEnum(MedicineRoute)
  route?: MedicineRoute;

  @IsOptional()
  @IsDateString()
  administeredAt?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  administeredBy?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  stockDeductionQuantity?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchNo?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  milkWithdrawalDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  meatWithdrawalDays?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** RD-084: same as `LogTreatmentDto.financialAccountId` — no longer read. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;
}

export class CreateHealthUpdateDto {
  @IsEnum(ClinicalProgress)
  clinicalProgress!: ClinicalProgress;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsEnum(AppetiteStatus)
  appetite?: AppetiteStatus;

  @IsOptional()
  @IsEnum(AppearanceStatus)
  appearance?: AppearanceStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  observation?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  recordedBy?: string;
}

export class MortalityDto {
  @IsDateString()
  deathDate!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  primaryCauseOfDeath!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  vetSignOff?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsBoolean()
  postMortemPerformed?: boolean;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  disposalMethod?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  disposalCost?: number;

  /** Account the disposal cost is paid from; required when `disposalCost` > 0. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  disposalLocation?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  additionalNotes?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  recordedBy?: string;
}

export class CloseHealthCaseDto {
  @IsEnum(HealthCloseOutcome)
  outcome!: HealthCloseOutcome;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  observation?: string;

  @IsOptional()
  mortality?: MortalityDto;
}

export class RescheduleHealthTaskDto {
  @IsDateString()
  newDueDateTime!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  reason?: string;
}

export class SkipHealthTaskDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  reason?: string;
}

/** `POST /health/treatments` (RAKHAL-416) — record a treatment against one or more animals with
 * no case id: an open case for each animal is reused, or a minimal one is opened silently.
 * Withdrawal is derived from `Medicine.milkWithdrawalDays`/`meatWithdrawalDays`, not typed here. */
export class RecordTreatmentDto {
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }): unknown =>
    Array.isArray(value)
      ? [...new Set(value.map((v) => String(v).trim()))]
      : value,
  )
  cattleIds!: string[];

  /** Inventory medicine. Required unless `outsideInventory` is set. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  medicineId?: string;

  /** Hand-typed medicine name; only used with `outsideInventory` (no stock, no medicine cost). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  medicineName?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  outsideInventory?: boolean;

  /** One vet fee for the whole visit, in ৳; needs `financialAccountId`. Linked to the first animal's log. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  vetCost?: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  doseAmount!: number;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  doseUnit!: string;

  /** `Unit.id` of `doseUnit`; converted to the medicine's own stock unit when deducting. Omit = already in it. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  doseUnitId?: string;

  @IsEnum(MedicineRoute)
  route!: MedicineRoute;

  @IsDateString()
  treatedAt!: string;

  @IsOptional()
  @IsEnum(HealthCareType)
  careType?: HealthCareType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  reason?: string;

  /** Structured condition for the case opened when the animal has no open one (same enum as
   * `CreateHealthCaseDto.condition`). Ignored when an open case is reused. The TREATMENT event
   * path requires it when it has to open a case. */
  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** RD-084: same as `LogTreatmentDto.financialAccountId` — no longer read. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;
}
