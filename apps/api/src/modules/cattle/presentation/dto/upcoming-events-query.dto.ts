import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** `GET /cattle/:id/upcoming-events` (RAKHAL-475) — both default server-side (14 days, 10 events). */
export class UpcomingEventsQueryDto {
  /** Look-ahead in farm days; overdue items are always included. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(90)
  windowDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
