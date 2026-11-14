import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  HealthCareType,
  HealthCaseStatus,
  HealthCondition,
  HealthPriority,
} from '@prisma/client';
import { trimString } from './common.dto';

export class UpdateHealthCaseDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  @IsOptional()
  @IsEnum(HealthCareType)
  careType?: HealthCareType;

  @IsOptional()
  @IsEnum(HealthPriority)
  priority?: HealthPriority;

  @IsOptional()
  @IsEnum(HealthCaseStatus)
  status?: HealthCaseStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assignedVet?: string;

  @IsOptional()
  @IsDateString()
  expectedRecoveryDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
