import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `GET /feed/grid` — one day's per-cow feeding grid, optionally scoped to one feed group. */
export class FeedGridQueryDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;
}
