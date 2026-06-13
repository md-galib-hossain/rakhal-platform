import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { HeatDetectionMethod } from '@prisma/client';
import { BooleanSymptomsDto, trimString } from './common.dto';

export class CreateHeatEventDto extends BooleanSymptomsDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @IsDateString()
  heatDateTime!: string;

  @IsEnum(HeatDetectionMethod)
  detectionMethod!: HeatDetectionMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
