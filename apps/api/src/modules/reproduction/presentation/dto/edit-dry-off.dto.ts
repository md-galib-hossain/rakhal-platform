import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DryOffReason } from '@prisma/client';
import { trimString } from './common.dto';

/**
 * RAKHAL-305: edit a `DryPeriod`. Every field optional. `cattleId` change
 * refreshes derived state for both cows via `ReproductionEditService`.
 * `dryOffDate` moves `Lactation.endDate` and `DryPeriod.expectedEndDate`
 * together (matched by the old `startDate`, since there is no back-link
 * column between `DryPeriod` and `Lactation`).
 */
export class EditDryOffDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsDateString()
  dryOffDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(DryOffReason)
  reason?: DryOffReason;
}
