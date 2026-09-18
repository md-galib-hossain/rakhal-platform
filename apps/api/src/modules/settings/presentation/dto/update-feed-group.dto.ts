import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FeedGridSourceType } from '@prisma/client';
import { trimString } from 'src/common/dto';

export class UpdateFeedGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  description?: string;

  /** Refusal-rate target, % of planned kg (2026-08-13, feeding-system upgrade). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  refusalTargetPct?: number;

  /** Default recipe for one-click "Feed Today" (2026-08-14). Must be a `FEED_MIXTURE` concentration
   * owned by this farm (validated in the service, not here) — pass `null` to clear it. */
  @IsOptional()
  @IsString()
  defaultConcentrationId?: string | null;

  /** RAKHAL-433 (Feeding Favourites): this group's default Feeding Grid source — the fallback the
   * resolution ladder (`FeedFeedingGridService.resolveDefaultSources`, RAKHAL-431) falls through to
   * once a cow has no usable own-last-used source. Separate from `defaultConcentrationId` above,
   * which stays reserved for the one-click "Feed Today" TMR flow. Pass `null` to clear the default
   * entirely (also nulls `defaultFeedItemId`/`defaultFeedStockId`); ownership of the referenced
   * item/stock is validated in the service, not here. */
  @IsOptional()
  @IsEnum(FeedGridSourceType)
  defaultFeedSourceType?: FeedGridSourceType | null;

  @ValidateIf(
    (o: UpdateFeedGroupDto) => o.defaultFeedSourceType === 'FEED_ITEM',
  )
  @IsString()
  @IsNotEmpty()
  defaultFeedItemId?: string;

  @ValidateIf(
    (o: UpdateFeedGroupDto) => o.defaultFeedSourceType === 'FEED_STOCK',
  )
  @IsString()
  @IsNotEmpty()
  defaultFeedStockId?: string;
}
