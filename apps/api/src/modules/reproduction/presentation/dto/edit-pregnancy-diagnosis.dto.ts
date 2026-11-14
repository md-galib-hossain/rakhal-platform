import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  PregnancyDiagnosisMethod,
  PregnancyDiagnosisResult,
} from '@prisma/client';
import { trimString } from './common.dto';

/**
 * RAKHAL-305: edit a `PregnancyDiagnosis`. Every field optional.
 * `result` PREGNANT→NOT_PREGNANT retires the `Pregnancy` created via
 * `sourceDiagnosisId` and reverses its AQR +5; `expectedCalvingDate`
 * change recomputes `Pregnancy.expectedCalvingDate` (and, through
 * `refreshDerivedState`, `Lactation.recommendedDryOffAt`). See
 * `ReproductionEditService.editPregnancyDiagnosis`.
 */
export class EditPregnancyDiagnosisDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breedingEventId?: string;

  @IsOptional()
  @IsDateString()
  diagnosisDate?: string;

  @IsOptional()
  @IsEnum(PregnancyDiagnosisResult)
  result?: PregnancyDiagnosisResult;

  @IsOptional()
  @IsEnum(PregnancyDiagnosisMethod)
  diagnosisMethod?: PregnancyDiagnosisMethod;

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
