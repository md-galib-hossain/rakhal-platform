import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  PregnancyDiagnosisMethod,
  PregnancyDiagnosisResult,
} from '@prisma/client';
import { trimString } from './common.dto';

export class CreatePregnancyDiagnosisDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breedingEventId?: string;

  @IsDateString()
  diagnosisDate!: string;

  @IsEnum(PregnancyDiagnosisResult)
  result!: PregnancyDiagnosisResult;

  @IsEnum(PregnancyDiagnosisMethod)
  diagnosisMethod!: PregnancyDiagnosisMethod;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  gestationDay?: number;

  @IsOptional()
  @IsDateString()
  expectedCalvingDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
