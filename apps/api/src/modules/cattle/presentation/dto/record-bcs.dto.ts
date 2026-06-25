import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BCS_ALLOWED_SCORES } from '../../domain/cattle.constants';
import { trimString } from './common.dto';

/** Record a Body Condition Score (PRD §8.6, RAKHAL-038). `POST /cattle/:id/bcs`. */
export class RecordBcsDto {
  @IsNumber()
  @IsIn(BCS_ALLOWED_SCORES)
  score!: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
