import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  BreedingMethod,
  PaymentMethod,
  SemenSource,
  SemenType,
  TargetSex,
} from '@prisma/client';
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
  @IsEnum(SemenSource)
  semenSource?: SemenSource;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  serviceProviderId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  sireNameOrCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  sireBreed?: string;

  @IsOptional()
  @IsEnum(SemenType)
  semenType?: SemenType;

  @IsOptional()
  @IsEnum(TargetSex)
  targetSex?: TargetSex;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  strawBatchCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  semenCompany?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  serviceCost?: number;

  /// RAKHAL-330: how the breeding/AI cost gets paid — required (service-level)
  /// whenever a cost > 0 is actually being posted to Finance.
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

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
