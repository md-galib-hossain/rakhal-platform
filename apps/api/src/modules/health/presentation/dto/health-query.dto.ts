import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  HealthActionType,
  HealthCaseStatus,
  HealthPlanCategory,
  HealthPlanType,
  HealthPriority,
  HealthTaskStatus,
  SafetyWithdrawalStatus,
} from '@prisma/client';
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
  @Transform(trimString)
  @IsString()
  farmId!: string;

  @Transform(({ value }) => Number(value))
  month!: number;

  @Transform(({ value }) => Number(value))
  year!: number;
}

export class SafetyWithdrawalQueryDto extends HealthListQueryDto {
  @IsOptional()
  @IsEnum(SafetyWithdrawalStatus)
  status?: SafetyWithdrawalStatus;
}
