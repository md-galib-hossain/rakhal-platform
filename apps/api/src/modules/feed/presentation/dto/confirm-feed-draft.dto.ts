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

/** `POST /feed/grid/confirm` — turn a day's feeding-grid quantities into a real `FeedDistribution`
 * + inventory decrement. `entries` is optional: omit it to confirm straight from whatever's
 * already been drafted for `date` (falling back further to each cow's carried-forward default
 * where neither an entry nor a draft exists) — see `FeedFeedingGridService#confirm`.
 *
 * RAKHAL-430 (Feeding Favourites): a confirm is no longer one source for the whole call — each
 * `entries[]` line (and each existing draft) can carry its own source (`FeedDraftEntryDto`'s own
 * doc comment). The top-level `sourceType`/`feedItemId`/`feedStockId` below are now the default
 * for lines that don't name their own, still required whenever the call needs one (an unnamed cow
 * with no matching draft has nothing else to resolve against — RAKHAL-431's resolution ladder is
 * the future replacement for this fallback). One `FeedDistributionItem` is now written per
 * *distinct* resolved source in the call, not always exactly one. */
export class ConfirmFeedDraftDto {
  /** Distribution date (YYYY-MM-DD). */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsEnum(FeedGridSourceType)
  sourceType?: FeedGridSourceType;

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
