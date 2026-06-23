import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { HealthDiagnosisType, HealthPriority } from '@prisma/client';
import { trimString } from './common.dto';

export class CreateHealthCaseDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  farmId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  diagnosis!: string;

  @IsEnum(HealthDiagnosisType)
  diagnosisType!: HealthDiagnosisType;

  @IsEnum(HealthPriority)
  priority!: HealthPriority;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  reportedBy?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assignedVet?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

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
