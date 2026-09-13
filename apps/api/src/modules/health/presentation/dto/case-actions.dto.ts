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
  HealthCloseOutcome,
  MedicineRoute,
} from '@prisma/client';
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

  /** RAKHAL-419: required whenever `Medicine.costPerUnit × doseAmount` is a
   * real cost being posted to Finance (RD-066's rule, per RAKHAL-393) — a
   * zero-cost medicine or a treatment with no medicine posts nothing and
   * needs no account. */
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

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  medicineId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  doseAmount!: number;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  doseUnit!: string;

  @IsEnum(MedicineRoute)
  route!: MedicineRoute;

  @IsDateString()
  treatedAt!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  reason?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** RAKHAL-419: required whenever `Medicine.costPerUnit × doseAmount` is a
   * real cost being posted to Finance (RD-066's rule, per RAKHAL-393) — a
   * zero-cost medicine posts nothing and needs no account. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;
}
