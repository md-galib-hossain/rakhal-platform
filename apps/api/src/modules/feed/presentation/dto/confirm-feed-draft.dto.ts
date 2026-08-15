import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FeedGridSourceType } from '@prisma/client';
import { trimString } from 'src/common/dto';
import { FeedDraftEntryDto } from './save-feed-draft.dto';

/** `POST /feed/grid/confirm` — turn a day's feeding-grid quantities for one feed source into a real
 * `FeedDistribution` + inventory decrement. `entries` is optional: omit it to confirm straight from
 * whatever's already been drafted for `date`+`sourceType` (falling back further to each cow's
 * carried-forward default where neither an entry nor a draft exists) — see
 * `FeedFeedingGridService#confirm`. */
export class ConfirmFeedDraftDto {
  /** Distribution date (YYYY-MM-DD). */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsEnum(FeedGridSourceType)
  sourceType!: FeedGridSourceType;

  @ValidateIf((o: ConfirmFeedDraftDto) => o.sourceType === 'FEED_ITEM')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedItemId?: string;

  @ValidateIf((o: ConfirmFeedDraftDto) => o.sourceType === 'FEED_STOCK')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedStockId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedDraftEntryDto)
  entries?: FeedDraftEntryDto[];
}
