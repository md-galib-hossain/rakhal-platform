import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CattlePurpose } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Record a weaning event (PRD §14.4). The calf leaves Calf Management and
 * re-enters the main herd; `newPurpose` overrides the gender-based default
 * (FEMALE → BREEDING, otherwise MEAT).
 */
export class WeanCalfDto {
  @IsDateString()
  weaningDate!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  weaningWeightKg?: number;

  @IsOptional()
  @IsEnum(CattlePurpose)
  newPurpose?: CattlePurpose;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
