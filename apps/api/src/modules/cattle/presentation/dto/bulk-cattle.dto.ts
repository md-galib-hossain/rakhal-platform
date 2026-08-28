import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** Bulk operations on a selection of cattle (PRD §8.3, RAKHAL-037). */
export const BULK_ACTIONS = [
  'change_shed',
  'change_feed_group',
  'mark_sold',
  'dispose',
  'export',
] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** `dispose`'s 3 lifecycle-exit types — mirrors `CattleDispositionType` minus `TRANSFER` (not a
 * user-facing bulk scenario). Replaces the single-purpose `mark_sold` action with one dock action
 * covering sell/cull/dead (UX request, no ticket #); `mark_sold` stays wired for compat. */
export const BULK_DISPOSE_TYPES = ['SALE', 'CULL', 'DEATH'] as const;
export type BulkDisposeType = (typeof BULK_DISPOSE_TYPES)[number];

/** Optional payload for the action (e.g. target shed / feed group / dispose type). */
export class BulkCattlePayloadDto {
  @IsOptional()
  @IsString()
  shedId?: string;

  @IsOptional()
  @IsString()
  feedGroupId?: string;

  @IsOptional()
  @IsIn(BULK_DISPOSE_TYPES)
  type?: BulkDisposeType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class BulkCattleDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  cattleIds!: string[];

  @IsIn(BULK_ACTIONS)
  action!: BulkAction;

  @IsOptional()
  @ValidateNested()
  @Type(() => BulkCattlePayloadDto)
  payload?: BulkCattlePayloadDto;
}
