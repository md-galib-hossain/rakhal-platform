import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  HealthActionType,
  HealthCaseStatus,
  HealthPlanCategory,
  HealthPlanType,
  HealthPriority,
  HealthTaskStatus,
  SafetyWithdrawalStatus,
} from '@prisma/client';
import { toBoolean } from 'src/common/dto';
import { HealthListQueryDto, trimString } from './common.dto';

export class SickBayQueryDto extends HealthListQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  shed?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsEnum(HealthPriority)
  priority?: HealthPriority;

  @IsOptional()
  @IsEnum(HealthCaseStatus)
  status?: HealthCaseStatus;
}

export class HealthPlanQueryDto extends HealthListQueryDto {
  @IsOptional()
  @IsEnum(HealthPlanCategory)
  category?: HealthPlanCategory;

  @IsOptional()
  @IsEnum(HealthPlanType)
  planType?: HealthPlanType;
}

export class HealthTaskQueryDto extends HealthListQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(HealthTaskStatus)
  status?: HealthTaskStatus;

  @IsOptional()
  @IsEnum(HealthActionType)
  type?: HealthActionType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  healthCaseId?: string;
}

export class HealthTaskCalendarQueryDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2000)
  year!: number;
}

export class SafetyWithdrawalQueryDto extends HealthListQueryDto {
  @IsOptional()
  @IsEnum(SafetyWithdrawalStatus)
  status?: SafetyWithdrawalStatus;

  /** RAKHAL-420: rows still withholding (ACTIVE or READY_FOR_RELEASE) — the milk-room question
   * ("who can't go in the tank today") in one request instead of the caller filtering client-side. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class AppliedPlansQueryDto extends HealthListQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  healthPlanId?: string;
}
