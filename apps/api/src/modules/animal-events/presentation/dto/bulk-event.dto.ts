import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ANIMAL_EVENT_TYPES,
  type AnimalEventTypeKey,
} from '../../domain/catalogue';
import { FollowUpToggleDto } from './record-event.dto';

/**
 * Body of `POST /animal-events/bulk` (RAKHAL-489). One type, one date and one shared payload for up
 * to 100 animals; `values` adds the per-animal part for WEIGHT, BCS and PREG_CHECK. No `farmId`.
 */
export class BulkEventDto {
  @IsIn(ANIMAL_EVENT_TYPES)
  type!: AnimalEventTypeKey;

  @IsISO8601()
  eventAt!: string;

  @IsOptional()
  @IsIn(['RECORDED', 'HISTORICAL'])
  provenance?: 'RECORDED' | 'HISTORICAL';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Required when `type` is CUSTOM. */
  @IsOptional()
  @IsString()
  customTypeId?: string;

  /** Fields every animal shares (same shape as `POST /cattle/:id/events` payload). */
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  /**
   * Per-animal fields, keyed by cattle id, merged over `payload`. Only for WEIGHT (`weightKg`),
   * BCS (`score`) and PREG_CHECK (`result`, ...). A key that is not in `cattleIds` is a 400.
   */
  @IsOptional()
  @IsObject()
  values?: Record<string, Record<string, unknown>>;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  cattleIds!: string[];

  /**
   * `skipIneligible` (default): animals with a BLOCK finding are skipped with a reason and the rest
   * are saved. `allOrNothing`: any blocked animal fails the whole request (422) and nothing is saved.
   */
  @IsOptional()
  @IsIn(['skipIneligible', 'allOrNothing'])
  mode?: 'skipIneligible' | 'allOrNothing';

  /** The chip used to pick the animals (stored on the batch). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FollowUpToggleDto)
  followUps?: FollowUpToggleDto[];
}
