import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  HealthCareType,
  HealthCondition,
  HealthPriority,
} from '@prisma/client';
import { trimString } from './common.dto';

/** Most animals one outbreak report can cover — keeps the single transaction and the follow-up work bounded. */
export const BULK_REPORT_MAX_ANIMALS = 100;

/**
 * `POST /health/cases/bulk` (RAKHAL-469, MILESTONE 29) — one condition reported for several animals at once (an
 * outbreak: mastitis in a shed, foot rot in a pen). The shared fields are those of `CreateHealthCaseDto` that make
 * sense for a group; per-animal vitals, shed override and photo stay single-case concerns. At least one of `condition`
 * / `note` is required (checked in the service) — without either there is nothing to tell a duplicate from a new case.
 */
export class BulkCreateHealthCasesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_REPORT_MAX_ANIMALS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  cattleIds!: string[];

  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  note?: string;

  /** Defaults to `CURATIVE` — a group sickness report is, by nature, curative. */
  @IsOptional()
  @IsEnum(HealthCareType)
  careType?: HealthCareType;

  @IsEnum(HealthPriority)
  priority!: HealthPriority;

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
