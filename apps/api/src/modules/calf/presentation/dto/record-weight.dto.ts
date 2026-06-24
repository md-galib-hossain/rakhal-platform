import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** Record a calf weight (PRD §14.4); the response includes the computed ADG. */
export class RecordWeightDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  weightKg!: number;

  @IsDateString()
  measuredDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
