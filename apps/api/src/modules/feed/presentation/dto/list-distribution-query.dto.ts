import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { trimString } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /feed/distributions` — cursor list with optional group/cattle/formula/date filters.
 * `cattleId` added Phase 12.4 (2026-07-18) alongside `feedGroupId` — a cow's own feeding history. */
export class ListDistributionQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  concentrationId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must be YYYY-MM-DD' })
  toDate?: string;
}

/** `GET /feed/efficiency` — planned-vs-actual + feed cost per litre for a group OR a single cow,
 * over a month. Exactly one of `feedGroupId`/`cattleId` is required (Phase 12.4, 2026-07-18 —
 * `cattleId` is new, `feedGroupId` predates it and was unconditionally required until now). */
export class FeedEfficiencyQueryDto {
  @ValidateIf((o: FeedEfficiencyQueryDto) => !o.cattleId)
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @ValidateIf((o: FeedEfficiencyQueryDto) => !o.feedGroupId)
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' })
  month?: string;
}
