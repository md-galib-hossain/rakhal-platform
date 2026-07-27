import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
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
}
