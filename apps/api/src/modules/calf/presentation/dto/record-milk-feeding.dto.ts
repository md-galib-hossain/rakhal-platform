import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CalfMilkType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Record a daily calf milk feeding (PRD §14.4). */
export class RecordMilkFeedingDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  morningMl?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  eveningMl?: number;

  @IsOptional()
  @IsEnum(CalfMilkType)
  type?: CalfMilkType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
