import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** One actual-distribution line. User request 2026-09-23: "Feed Today" must not be limited to
 * whatever's baked into the target TMR/concentrate recipe — a farm feeds whatever's actually in
 * front of the cow. `ingredientId` naming one of the concentration's own lines overrides that
 * line's actual/refusal kg (as before); naming any other real `FeedIngredient` catalogue entry adds
 * a brand new line to this distribution (`plannedKg: 0` — nothing was planned for it). Either way
 * the ingredient must exist in the catalogue (validated in `FeedDistributionService#create`). */
export class DistributionItemDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  /** Actual kg distributed (defaults to the formula's planned amount if omitted). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300, { message: 'actualKg must not exceed 300 kg' })
  actualKg?: number;

  /** Refusal / leftover kg (informational; feeds efficiency, not cost). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300, { message: 'refusalKg must not exceed 300 kg' })
  refusalKg?: number;

  /** A specific `FeedStock` lot to decrement `actualKg` from (real FK-backed linkage, user request
   * 2026-07-17 — "feeding a cow deducts from that specific inventory feed stock"). Optional — omit
   * to keep using the existing best-effort `FeedItem` FK-match decrement for this line. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  stockId?: string;
}

/** `POST /feed/distributions` — log a day's feed distribution for a concentration (§12.5). */
export class LogDistributionDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  concentrationId!: string;

  /** Distribution date (YYYY-MM-DD); defaults to today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'distributedAt must be YYYY-MM-DD',
  })
  distributedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  notes?: string;

  /**
   * Per-ingredient actual/refusal overrides. Omit to distribute exactly the
   * planned amounts; partial lists fall back to planned for unlisted ingredients.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DistributionItemDto)
  items?: DistributionItemDto[];
}
