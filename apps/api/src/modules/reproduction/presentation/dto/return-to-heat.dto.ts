import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { HeatDetectionMethod } from '@prisma/client';
import { trimString } from './common.dto';

/** `:id` (the `BreedingEvent` being invalidated) comes from the route param,
 * not the body (RAKHAL convention) — see `resolve-heat-event.dto.ts`. */
export class ReturnToHeatDto {
  @IsDateString()
  heatDateTime!: string;

  @IsOptional()
  @IsEnum(HeatDetectionMethod)
  detectionMethod?: HeatDetectionMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
