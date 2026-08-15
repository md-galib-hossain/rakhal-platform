import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FeedGridSourceType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** One cow's draft quantity for a `SaveFeedDraftDto`/`ConfirmFeedDraftDto` call. */
export class FeedDraftEntryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @IsNumber()
  @Min(0)
  quantityKg!: number;
}

/** `POST /feed/grid/draft` — auto-save a day's per-cow feeding-grid quantities for one feed
 * source. No inventory effect — purely pre-confirm editable state (`FeedFeedingDraft`). */
export class SaveFeedDraftDto {
  /** Draft date (YYYY-MM-DD). */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsEnum(FeedGridSourceType)
  sourceType!: FeedGridSourceType;

  @ValidateIf((o: SaveFeedDraftDto) => o.sourceType === 'FEED_ITEM')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedItemId?: string;

  @ValidateIf((o: SaveFeedDraftDto) => o.sourceType === 'FEED_STOCK')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedStockId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedDraftEntryDto)
  entries!: FeedDraftEntryDto[];
}
