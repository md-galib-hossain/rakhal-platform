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
  HealthCareType,
  HealthCondition,
  HealthPriority,
} from '@prisma/client';
import { trimString } from './common.dto';

export class CreateHealthCaseDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  /** RAKHAL-418: was the required `diagnosis` field — `condition` below is now the primary
   * structured classifier, this is optional free-text detail alongside it. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  /** RAKHAL-418: replaces the 8-value `diagnosisType` — curative vs preventive is all any
   * consumer outside Health ever needed. */
  @IsEnum(HealthCareType)
  careType!: HealthCareType;

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
