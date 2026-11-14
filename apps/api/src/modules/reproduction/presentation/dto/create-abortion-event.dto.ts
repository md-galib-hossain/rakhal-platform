import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from './common.dto';

export class CreateAbortionEventDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  pregnancyId?: string;

  @IsDateString()
  abortionDate!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  gestationDay?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  suspectedCause?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
