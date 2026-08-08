import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BreedingMethod } from '@prisma/client';
import { trimString } from './common.dto';

/**
 * RAKHAL-305: edit a `BreedingEvent`. Every field optional. `status` is
 * absent — it's derived by `refreshDerivedState` (RAKHAL-301), never
 * directly writable. Materialized side effects handled by
 * `ReproductionEditService.editBreedingEvent`: `semenBatchId` change moves
 * straws, `breedingDate` change reschedules the pregnancy-check task,
 * `bullId` change updates any calf's `fatherId`.
 */
export class EditBreedingEventDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsDateString()
  breedingDate?: string;

  @IsOptional()
  @IsEnum(BreedingMethod)
  breedingMethod?: BreedingMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  bullId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  semenBatchId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  inseminator?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  breedingNumber?: number;

  @IsOptional()
  @IsDateString()
  expectedPregnancyCheckDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
