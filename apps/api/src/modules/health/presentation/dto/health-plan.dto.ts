import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  HealthActionType,
  HealthPlanCategory,
  HealthPlanType,
  MedicineRoute,
} from '@prisma/client';
import { trimString } from './common.dto';

export class HealthPlanStepDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  dayNumber!: number;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsEnum(HealthActionType)
  actionType!: HealthActionType;

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
  @Transform(trimString)
  @IsString()
  instruction?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  estimatedTime?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  milkWithdrawalDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  meatWithdrawalDays?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class CreateHealthPlanDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(HealthPlanCategory)
  category!: HealthPlanCategory;

  @IsEnum(HealthPlanType)
  planType!: HealthPlanType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  cycleLengthDays?: number;

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthPlanStepDto)
  steps!: HealthPlanStepDto[];
}

export class UpdateHealthPlanDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(HealthPlanCategory)
  category?: HealthPlanCategory;

  @IsOptional()
  @IsEnum(HealthPlanType)
  planType?: HealthPlanType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  cycleLengthDays?: number;

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthPlanStepDto)
  steps?: HealthPlanStepDto[];
}

/** `POST /health/plans/:id/apply` (RAKHAL-414) — bulk-apply one plan to many animals in a single
 * call, replacing the frontend's old create-case-then-apply-plan loop (2N sequential requests). */
export class ApplyPlanToAnimalsDto {
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }): unknown =>
    Array.isArray(value)
      ? [...new Set(value.map((v) => String(v).trim()))]
      : value,
  )
  cattleIds!: string[];

  @IsOptional()
  @IsString()
  startDate?: string;

  /** Accepted for API-shape parity with the apply wizard's own form; each `HealthPlanStep`
   * already carries its own `route`, so this is not currently read by the service. */
  @IsOptional()
  @IsEnum(MedicineRoute)
  route?: MedicineRoute;
}
