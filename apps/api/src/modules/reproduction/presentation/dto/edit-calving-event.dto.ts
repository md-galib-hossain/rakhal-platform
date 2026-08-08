import { Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CalvingEase } from '@prisma/client';
import { toBoolean, trimString } from './common.dto';
import { CreateCalfBirthDto } from './create-calving-event.dto';

/**
 * RAKHAL-306: edit a `CalvingEvent`. `calvingDate` cascades to the
 * calving-created `Lactation.startDate`, every existing calf's
 * `dateOfBirth`, the linked `Pregnancy.gestationDays`, and every non-completed
 * Task (colostrum + calf-care schedule) tagged with this event — shifted by
 * the same delta so their relative offsets are preserved.
 *
 * Calf list changes are explicit add/remove lists, not a full-array diff:
 * `addCalves` creates new `Cattle`+`CalfBirth` rows (AQR +50 each);
 * `removeCalfBirthIds` archives the calf's `Cattle` row (never deletes) and
 * reverses its AQR +50 — 409s naming her tag number if she has accumulated
 * her own records (weights/BCS/health/milk/offspring).
 */
export class EditCalvingEventDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsDateString()
  calvingDate?: string;

  @IsOptional()
  @IsEnum(CalvingEase)
  calvingEase?: CalvingEase;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  placentaExpelled?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  retainedPlacenta?: boolean;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  complications?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCalfBirthDto)
  addCalves?: CreateCalfBirthDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  removeCalfBirthIds?: string[];
}
