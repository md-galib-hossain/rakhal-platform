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
