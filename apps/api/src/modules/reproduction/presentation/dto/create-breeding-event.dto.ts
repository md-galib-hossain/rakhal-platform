import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
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

export class CreateBreedingEventDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @IsDateString()
  breedingDate!: string;

  @IsEnum(BreedingMethod)
  breedingMethod!: BreedingMethod;

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
