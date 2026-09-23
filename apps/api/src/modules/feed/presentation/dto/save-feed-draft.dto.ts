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

/** One cow's draft quantity for a `SaveFeedDraftDto`/`ConfirmFeedDraftDto` call.
 *
 * RAKHAL-430 (Feeding Favourites, `docs/EPIC_FEEDING_FAVOURITES.md`): gained its own optional
 * source override — when set, this entry's own `sourceType`/`feedItemId`/`feedStockId` wins over
 * the call's top-level source, letting one grid submission feed different cows from different
 * sources. When omitted, the entry falls back to the top-level source exactly as before
 * (`FeedFeedingGridService#resolveEntrySource`). At least one of "this entry's own source" or
 * "the call's top-level source" must be resolvable — enforced in the service, not here, since it
 * depends on the sibling top-level fields.
 */
export class FeedDraftEntryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  /** What was offered to this cow, not what she actually ate — a real farm can't reliably
   * measure per-cow intake (2026-08-15 rename from `quantityKg`). */
  @IsNumber()
  @Min(0)
  offeredKg!: number;

  /// User request 2026-09-23: this farm's cows each eat from their own container, so leftover is
  /// reliably measurable per cow (unlike the shared-bunk case `offeredKg`'s doc comment above
  /// describes). Optional — omit when not weighed back; defaults to 0 on confirm.
  @IsOptional()
  @IsNumber()
  @Min(0)
  refusalKg?: number;

  @IsOptional()
  @IsEnum(FeedGridSourceType)
  sourceType?: FeedGridSourceType;

  @ValidateIf((o: FeedDraftEntryDto) => o.sourceType === 'FEED_ITEM')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedItemId?: string;

  @ValidateIf((o: FeedDraftEntryDto) => o.sourceType === 'FEED_STOCK')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedStockId?: string;
}

/** `POST /feed/grid/draft` — auto-save a day's per-cow feeding-grid quantities. No inventory
 * effect — purely pre-confirm editable state (`FeedFeedingDraft`).
 *
 * RAKHAL-430: the top-level `sourceType`/`feedItemId`/`feedStockId` are now the **default** source
 * for any entry that doesn't name its own (was the only source, mandatory, before this ticket) —
 * still the common single-source case, now optional so an all-per-entry call needs no default. */
export class SaveFeedDraftDto {
  /** Draft date (YYYY-MM-DD). */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsOptional()
  @IsEnum(FeedGridSourceType)
  sourceType?: FeedGridSourceType;

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
