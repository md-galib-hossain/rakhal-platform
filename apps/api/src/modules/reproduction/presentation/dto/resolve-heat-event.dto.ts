import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { HeatResolutionReason } from '@prisma/client';
import { trimString } from './common.dto';

/** `:id` comes from the route param, not the body (RAKHAL convention). */
export class ResolveHeatEventDto {
  @IsEnum(HeatResolutionReason)
  reason!: HeatResolutionReason;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
