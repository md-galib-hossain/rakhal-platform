import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { HeatDetectionMethod } from '@prisma/client';
import { BooleanSymptomsDto, trimString } from './common.dto';

/**
 * RAKHAL-305: edit a `HeatEvent`. Every field optional — there is no
 * cosmetic/load-bearing split. `resolvedAt`/`resolvedByBreedingEventId`/
 * `resolutionReason` are deliberately absent — those stay owned by
 * `createBreedingEvent` (auto-resolve) and `POST .../resolve` (manual).
 */
export class EditHeatEventDto extends BooleanSymptomsDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsDateString()
  heatDateTime?: string;

  @IsOptional()
  @IsEnum(HeatDetectionMethod)
  detectionMethod?: HeatDetectionMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
