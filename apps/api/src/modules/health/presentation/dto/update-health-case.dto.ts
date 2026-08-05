import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  HealthCaseStatus,
  HealthCondition,
  HealthDiagnosisType,
  HealthPriority,
} from '@prisma/client';
import { trimString } from './common.dto';

export class UpdateHealthCaseDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  @IsOptional()
  @IsEnum(HealthDiagnosisType)
  diagnosisType?: HealthDiagnosisType;

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
