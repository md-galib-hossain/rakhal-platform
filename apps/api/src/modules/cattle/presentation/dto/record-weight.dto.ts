import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

export class RecordWeightDto {
  @IsNumber()
  @Min(10)
  @Max(2000)
  weightKg!: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  notes?: string;
}
