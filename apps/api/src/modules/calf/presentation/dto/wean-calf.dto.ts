import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * Record a weaning event (PRD §14.4). The calf leaves Calf Management and
 * re-enters the main herd.
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
  @Transform(trimString)
  @IsString()
  notes?: string;
}
