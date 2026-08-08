import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from './common.dto';

/**
 * RAKHAL-305: edit an `AbortionEvent`. Every field optional. A `pregnancyId`
 * change is handled entirely by `refreshDerivedState` (RAKHAL-301) — it
 * re-derives `Pregnancy.status` for both the old and new linked pregnancy
 * from live `AbortionEvent` rows, no manual flip needed.
 */
export class EditAbortionEventDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  pregnancyId?: string;

  @IsOptional()
  @IsDateString()
  abortionDate?: string;

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
