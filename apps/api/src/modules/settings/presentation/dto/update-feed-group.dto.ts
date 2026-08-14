import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
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
}
