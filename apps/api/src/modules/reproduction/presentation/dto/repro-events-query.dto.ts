import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** Unified reproduction events feed filter. */
export class ReproEventsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsIn([
    'heat',
    'breeding',
    'pregnancy_diagnosis',
    'calving',
    'abortion',
    'dry_period',
  ])
  eventType?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }: { value: string }) => value)
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }: { value: string }) => value)
  toDate?: string;
}
