import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
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
  'export',
] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** Optional payload for the action (e.g. target shed / feed group). */
export class BulkCattlePayloadDto {
  @IsOptional()
  @IsString()
  shedId?: string;

  @IsOptional()
  @IsString()
  feedGroupId?: string;
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
