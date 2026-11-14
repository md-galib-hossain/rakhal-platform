import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DryOffReason } from '@prisma/client';
import { trimString } from './common.dto';

/** `cattleId` comes from the `:id` route param, not the body (RAKHAL convention). */
export class CreateDryOffDto {
  /** Defaults to now if omitted. */
  @IsOptional()
  @IsDateString()
  dryOffDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** RAKHAL-274: optional reason for the dry-off. */
  @IsOptional()
  @IsEnum(DryOffReason)
  reason?: DryOffReason;
}
