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
import { BreedingMethod } from '@prisma/client';
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
