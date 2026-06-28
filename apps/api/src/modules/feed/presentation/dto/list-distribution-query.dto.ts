import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';
import { trimString } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /feed/distributions` — cursor list with optional group/formula/date filters. */
export class ListDistributionQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

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

/** `GET /feed/efficiency` — planned-vs-actual + feed cost per litre for a group/month. */
export class FeedEfficiencyQueryDto {
  @Transform(trimString)
  @IsString()
  feedGroupId!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' })
  month?: string;
}
