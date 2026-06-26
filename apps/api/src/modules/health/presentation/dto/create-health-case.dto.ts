import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AppetiteStatus,
  HealthDiagnosisType,
  HealthPriority,
} from '@prisma/client';
import { trimString } from './common.dto';

export class CreateHealthCaseDto {
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

  // Initial vitals captured by the Report Sickness form (PRD §8.7). When any are
  // present, an initial HealthUpdate is written to the new case's timeline.
  @IsOptional()
  @IsNumber()
  @Min(35)
  @Max(45)
  temperature?: number;

  @IsOptional()
  @IsEnum(AppetiteStatus)
  appetite?: AppetiteStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  staffObservation?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  photoUrl?: string;
}
